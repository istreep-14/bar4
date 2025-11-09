import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const htmlPath = resolve(root, 'tip-pool-tracker.html');

let html = readFileSync(htmlPath, 'utf8');

const externalScripts = [
  /<script src="https:\/\/unpkg.com\/react@18\/umd\/react\.production\.min\.js"><\/script>\s*/g,
  /<script src="https:\/\/unpkg.com\/react-dom@18\/umd\/react-dom\.production\.min\.js"><\/script>\s*/g,
  /<script src="https:\/\/unpkg.com\/@babel\/standalone\/babel\.min\.js"><\/script>\s*/g,
  /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js"><\/script>\s*/g,
];

externalScripts.forEach((pattern) => {
  html = html.replace(pattern, '');
});

html = html.replace(
  /<script type="text\/babel">[\s\S]*?ReactDOM\.render\(<App\s*\/>,\s*document\.getElementById\('root'\)\);\s*<\/script>/,
  '    <script type="module" src="./dist/assets/main.js"></script>',
);

writeFileSync(htmlPath, html);
console.log('Updated tip-pool-tracker.html');
