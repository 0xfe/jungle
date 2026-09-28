import { build } from 'esbuild';
import { mkdir, cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({ entryPoints: ['src/main.ts'], bundle: true, outfile: 'dist/app.js', format: 'esm', target: 'es2022', minify: true, sourcemap: true });
console.log('Built static site → dist/');
