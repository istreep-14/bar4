const express = require('express');
const path = require('path');
const fs = require('fs');
const net = require('net');

const isProd = process.env.NODE_ENV === 'production';
const rootDir = process.cwd();
const resolvePath = (...segments) => path.resolve(rootDir, ...segments);

async function findAvailablePort(startPort) {
  const maxPort = startPort + 100;
  for (let port = startPort; port <= maxPort; port += 1) {
    const isFree = await new Promise((resolve) => {
      const tester = net
        .createServer()
        .once('error', () => resolve(false))
        .once('listening', () => tester.close(() => resolve(true)))
        .listen(port);
    });
    if (isFree) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function createServer() {
  const app = express();
  const requestedPort = Number(process.env.PORT || 3000);
  const port = await findAvailablePort(requestedPort);
  if (port !== requestedPort) {
    console.warn(`⚠️  Port ${requestedPort} in use. Using ${port} instead.`);
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const hmrPort = await findAvailablePort(port + 1);
    const vite = await createViteServer({
      root: rootDir,
      server: {
        middlewareMode: true,
        hmr: {
          port: hmrPort,
        },
        watch: {
          // Avoid issues with large monorepos
          usePolling: !!process.env.USE_POLLING,
        },
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    console.log(`➜  Dev server ready at http://localhost:${port}`);
  } else {
    const distDir = resolvePath('dist');
    const indexHtml = path.join(distDir, 'index.html');

    if (!fs.existsSync(indexHtml)) {
      console.warn('dist/index.html not found. Did you run "npm run build"?');
    }

    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res) => {
      res.sendFile(indexHtml);
    });

    console.log(`➜  Serving dist/ on http://localhost:${port}`);
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mode: isProd ? 'production' : 'development' });
  });

  app.listen(port, () => {
    if (isProd) {
      console.log('➜  Production server running');
    }
  });
}

createServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
