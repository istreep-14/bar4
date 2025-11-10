#!/usr/bin/env node

/**
 * Lightweight control server that can bootstrap the existing static Python
 * server on demand. Designed to be run locally alongside Bar Tracker.
 */

const http = require('http');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const CONTROL_PORT = parseInt(process.env.CONTROL_PORT || '4100', 10);
const APP_PORT = parseInt(process.env.APP_PORT || '8000', 10);

let appProcess = null;
let startedAt = null;

const cwd = path.resolve(__dirname);

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function respond(res, statusCode, payload = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    ...JSON_HEADERS,
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function isSocketOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(750);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
}

function fetchJson(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: CONTROL_PORT,
        path: pathname,
        method: 'GET',
        timeout: 750,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }

        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw || '{}'));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.end();
  });
}

async function probeExistingControlServer() {
  try {
    const health = await fetchJson('/health');
    if (health?.ok) {
      const status = await fetchJson('/server/status');
      return { ok: true, status };
    }
  } catch (_) {
    // treat as not our server
  }
  return { ok: false };
}

async function ensureProcessHandle() {
  if (appProcess && appProcess.exitCode == null) {
    return true;
  }

  if (await isSocketOpen(APP_PORT)) {
    appProcess = null;
    startedAt = null;
    return true;
  }

  return false;
}

async function startAppServer() {
  const alreadyRunning = await ensureProcessHandle();
  if (alreadyRunning) {
    return { status: 'running', pid: appProcess?.pid || null, startedAt };
  }

  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-m', 'http.server', String(APP_PORT)], {
      cwd,
      stdio: 'ignore',
    });

    child.once('error', (err) => {
      reject(err);
    });

    child.once('spawn', () => {
      appProcess = child;
      startedAt = new Date();
      child.on('exit', () => {
        appProcess = null;
        startedAt = null;
      });

      resolve({ status: 'started', pid: child.pid, startedAt });
    });
  });
}

async function stopAppServer() {
  if (appProcess && appProcess.exitCode == null) {
    return new Promise((resolve) => {
      appProcess.once('exit', () => {
        appProcess = null;
        startedAt = null;
        resolve({ status: 'stopped' });
      });
      appProcess.kill();
    });
  }

  if (await isSocketOpen(APP_PORT)) {
    return { status: 'running-external' };
  }

  return { status: 'not-running' };
}

async function getStatus() {
  const runningByHandle = appProcess && appProcess.exitCode == null;
  const portOpen = await isSocketOpen(APP_PORT);

  return {
    running: runningByHandle || portOpen,
    managed: runningByHandle,
    pid: runningByHandle ? appProcess.pid : null,
    port: APP_PORT,
    startedAt,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, JSON_HEADERS);
    res.end();
    return;
  }

  if (req.url === '/server/status' && req.method === 'GET') {
    const status = await getStatus();
    respond(res, 200, status);
    return;
  }

  if (req.url === '/server/start' && req.method === 'POST') {
    try {
      const result = await startAppServer();
      respond(res, 202, result);
    } catch (error) {
      respond(res, 500, { error: error.message });
    }
    return;
  }

  if (req.url === '/server/stop' && req.method === 'POST') {
    try {
      const result = await stopAppServer();
      respond(res, 202, result);
    } catch (error) {
      respond(res, 500, { error: error.message });
    }
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    respond(res, 200, { ok: true });
    return;
  }

  respond(res, 404, { error: 'Not Found' });
});

function handleServerError(error) {
  if (error.code === 'EADDRINUSE') {
    probeExistingControlServer()
      .then((existing) => {
        if (existing.ok) {
          console.log(`Control server already running on http://localhost:${CONTROL_PORT}`);
          console.log('Existing status:', existing.status);
          process.exit(0);
        }

        console.error(
          `Port ${CONTROL_PORT} is already in use. Stop the existing process or run with CONTROL_PORT=<port> to choose a different port.`
        );
        process.exit(1);
      })
      .catch(() => {
        console.error(
          `Port ${CONTROL_PORT} is already in use. Stop the existing process or run with CONTROL_PORT=<port> to choose a different port.`
        );
        process.exit(1);
      });
  } else {
    console.error('Unexpected control server error:', error);
    process.exit(1);
  }
}

async function startControlServer() {
  const existing = await probeExistingControlServer();
  if (existing.ok) {
    console.log(`Control server already running on http://localhost:${CONTROL_PORT}`);
    console.log('Existing status:', existing.status);
    process.exit(0);
  }

  server.on('error', handleServerError);

  try {
    server.listen(CONTROL_PORT, () => {
      console.log(`Control server running on http://localhost:${CONTROL_PORT}`);
    });
  } catch (error) {
    handleServerError(error);
  }
}

startControlServer().catch((error) => {
  console.error('Failed to start control server:', error);
  process.exit(1);
});

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, async () => {
    if (appProcess && appProcess.exitCode == null) {
      appProcess.kill();
    }
    server.close(() => {
      process.exit(0);
    });
  });
});
