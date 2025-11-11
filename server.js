const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DIST_DIR = path.resolve(__dirname, 'dist');

app.use(express.json());

// Example API route stub
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve static assets after build
app.use(express.static(DIST_DIR));
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
