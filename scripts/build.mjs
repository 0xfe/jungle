import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { mkdir, cp, rm, readFile } from 'node:fs/promises';
const audio=JSON.parse(await readFile('assets/source/audio/provenance.json','utf8'));
for(const [path,expected] of [['assets/source/audio/elephant-trumpet.ogg',audio.sourceSha256],['public/assets/audio/elephant-trumpet.wav',audio.derivedSha256]]){
  if(createHash('sha256').update(await readFile(path)).digest('hex')!==expected)throw new Error(`Audio asset hash mismatch: ${path}. Restore the retained asset or update its reviewed provenance.`);
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({ entryPoints: ['src/main.ts'], bundle: true, outfile: 'dist/app.js', format: 'esm', target: 'es2022', minify: true, sourcemap: true });
console.log('Built static site → dist/');
