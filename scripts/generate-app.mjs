import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const htmlPath = resolve(root, 'tip-pool-tracker.html');
const outputPath = resolve(root, 'src/App.tsx');

const html = readFileSync(htmlPath, 'utf8');

const scriptStartToken = '<script type="text/babel">';
const renderToken = '// Render App';

const startIndex = html.indexOf(scriptStartToken);
if (startIndex === -1) {
  throw new Error('Failed to find <script type="text/babel"> in tip-pool-tracker.html');
}

const scriptStart = startIndex + scriptStartToken.length;
const renderIndex = html.indexOf(renderToken, scriptStart);
if (renderIndex === -1) {
  throw new Error('Failed to find render token in tip-pool-tracker.html');
}

let code = html.slice(scriptStart, renderIndex);

code = code.replace(
  /const\s+\{\s*useState\s*,\s*useEffect\s*,\s*useMemo\s*,\s*useRef\s*,\s*useCallback\s*\}\s*=\s*React;\s*/,
  '',
);

code = code.replace(
  /const\s+APP_SERVER_PORT[\s\S]*?function\s+serializeShiftForRow/,
  'function serializeShiftForRow',
);

code = code.replace(/window\.Chart/g, 'Chart');
code = code.replace(/if\s*\(!Chart\s*\|\|\s*!lineRef\.current\)/g, 'if (!lineRef.current)');
code = code.replace(/if\s*\(!Chart\s*\|\|\s*!barRef\.current\)/g, 'if (!barRef.current)');

const header = `import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';
import { APP_SERVER_PORT, CONTROL_SERVER_ORIGIN, ensureAppServerRunning } from './lib/serverControl';
import { sheetsAPI, SCOPES } from './lib/googleSheets';
import {
  loadStoredAuthToken,
  storeAuthToken,
  clearStoredAuthToken,
  loadCachedShifts,
  storeCachedShifts,
  loadPendingQueue,
  storePendingQueue,
  CONFIG_STORAGE_KEY,
  REMOTE_CONFIG_PATH,
  isOnline,
} from './lib/storage';

`;

const footer = `
export default App;
`;

writeFileSync(outputPath, header + code.trim() + footer);
console.log(`Generated ${outputPath}`);
