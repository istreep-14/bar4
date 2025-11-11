const express = require('express');
const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const ROOT = __dirname;
const DATA_DIR = path.resolve(ROOT, 'data');
const DIST_DIR = path.resolve(ROOT, 'dist');

const ensureDataDirectory = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const readJSON = (filePath, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return fallback;
  }
};

const writeJSON = (filePath, value) => {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const loadConfig = () => {
  const configPath = path.resolve(ROOT, 'config.json');
  const samplePath = path.resolve(ROOT, 'config.sample.json');
  const fallback = readJSON(samplePath, {});
  return readJSON(configPath, fallback);
};

const createDataStore = () => {
  const shiftsPath = path.join(DATA_DIR, 'shifts.json');
  const coworkersPath = path.join(DATA_DIR, 'coworkers.json');

  let shifts = readJSON(shiftsPath, []);
  let coworkers = readJSON(coworkersPath, []);

  const persistShifts = () => writeJSON(shiftsPath, shifts);
  const persistCoworkers = () => writeJSON(coworkersPath, coworkers);

  return {
    getShifts: () => [...shifts],
    addShift: (payload) => {
      const id = payload?.id || `shift-${Date.now()}`;
      const entry = { id, createdAt: new Date().toISOString(), ...payload };
      shifts = [entry, ...shifts];
      persistShifts();
      return entry;
    },
    getCoworkers: () => [...coworkers],
    addCoworker: (payload) => {
      const id = payload?.id || `coworker-${Date.now()}`;
      const entry = { id, createdAt: new Date().toISOString(), ...payload };
      coworkers = [entry, ...coworkers];
      persistCoworkers();
      return entry;
    },
  };
};

async function createServer() {
  ensureDataDirectory();

  const app = express();
  app.use(express.json());

  const store = createDataStore();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development' });
  });

  app.get('/api/config', (_req, res) => {
    res.json(loadConfig());
  });

  app.get('/api/shifts', (_req, res) => {
    res.json(store.getShifts());
  });

  app.post('/api/shifts', (req, res) => {
    const created = store.addShift(req.body || {});
    res.status(201).json(created);
  });

  app.get('/api/coworkers', (_req, res) => {
    res.json(store.getCoworkers());
  });

  app.post('/api/coworkers', (req, res) => {
    const created = store.addCoworker(req.body || {});
    res.status(201).json(created);
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
