import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sha256 = data => createHash('sha256').update(data).digest('hex');

/** Sorted relative paths, rejecting symlinks so a build cannot escape its directory. */
export async function listFiles(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(resolve(root, prefix), { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await listFiles(root, path + '/'));
    else if (entry.isFile()) result.push(path);
    else throw new Error(`Unsupported build entry: ${path}`);
  }
  return result.sort();
}

/** Validate the exact local release before any upload/delete operation. */
export async function verifyBuild(root) {
  const manifest = JSON.parse(await readFile(resolve(root, '.build-manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !manifest.files?.['index.html']) throw new Error('Invalid build receipt; run npm run build');
  const paths = (await listFiles(root)).filter(path => path !== '.build-manifest.json');
  if (JSON.stringify(paths) !== JSON.stringify(Object.keys(manifest.files).sort())) throw new Error('Build file inventory changed; run npm run build');
  for (const path of paths) {
    if (path !== 'index.html' && !/^assets\/[^/]+-[A-Za-z0-9]{8,64}\.[A-Za-z0-9.]+$/.test(path)) throw new Error(`Unversioned build asset: ${path}`);
    if (sha256(await readFile(resolve(root, path))) !== manifest.files[path]) throw new Error(`Build checksum mismatch: ${path}; run npm run build`);
  }
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyBuild(resolve(process.argv[2] ?? fileURLToPath(new URL('../dist', import.meta.url))));
  console.log('Build inventory and checksums verified.');
}
