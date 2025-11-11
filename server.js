const express = require('express');
const path = require('path');
const fs = require('fs');

const isProd = process.env.NODE_ENV === 'production';
const rootDir = process.cwd();
const resolvePath = (...segments) => path.resolve(rootDir, ...segments);

async function createServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: rootDir,
      server: {
        middlewareMode: true,
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
