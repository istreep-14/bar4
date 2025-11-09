import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const outdir = resolve(__dirname, 'dist/assets');

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: [resolve(__dirname, 'src/main.tsx')],
  bundle: true,
  format: 'esm',
  sourcemap: true,
  outdir,
  target: ['es2019'],
  logLevel: 'info',
  jsx: 'automatic',
  splitting: false,
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
};

const isWatch = process.argv.includes('--watch');

if (isWatch) {
  const ctx = await context(config);
  await ctx.watch();
  console.log('esbuild is watching for changes...');
} else {
  await build(config);
}
