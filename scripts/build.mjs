import { build } from 'esbuild';
import { mkdir, rm, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyBuild, listFiles, sha256 } from './verify-build.mjs';
import { buildInfo } from './build-info.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

/** Produce a self-contained deployment; public source paths stay stable for the baker/tests. */
export async function buildSite(root = projectRoot, destination = resolve(root, 'dist')) {
  root = await realpath(root);
  const metadata = await buildInfo(root);
  const audio = JSON.parse(await readFile(resolve(root, 'assets/source/audio/provenance.json'), 'utf8'));
  for (const [path, expected] of [['assets/source/audio/elephant-trumpet.ogg', audio.sourceSha256], ['public/assets/audio/elephant-trumpet.wav', audio.derivedSha256]]) {
    if (sha256(await readFile(resolve(root, path))) !== expected) throw new Error(`Audio asset hash mismatch: ${path}. Restore the retained asset or update its reviewed provenance.`);
  }
  await rm(destination, { recursive: true, force: true });
  await mkdir(resolve(destination, 'assets'), { recursive: true });
  destination = await realpath(destination);
  const result = await build({
    absWorkingDir: root, entryPoints: { app: 'src/main.ts', style: 'public/style.css' },
    bundle: true, outdir: resolve(destination, 'assets'), entryNames: '[name]-[hash]',
    assetNames: '[name]-[hash]', chunkNames: 'chunk-[hash]', format: 'esm', target: 'es2022',
    minify: true, sourcemap: true, metafile: true,
    define: { __BUILD_INFO__: JSON.stringify(metadata) },
    loader: { '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.svg': 'file', '.webp': 'file', '.gif': 'file', '.woff': 'file', '.woff2': 'file' },
    plugins: [{ name: 'asset-urls', setup(builder) {
      builder.onResolve({ filter: /\?url$/ }, args => ({ path: resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'asset-url' }));
      builder.onLoad({ filter: /.*/, namespace: 'asset-url' }, async args => ({ contents: await readFile(args.path), loader: 'file' }));
    } }],
  });
  const urls = new Map();
  for (const [output, info] of Object.entries(result.metafile.outputs)) {
    const url = './' + relative(destination, resolve(root, output)).split('\\').join('/');
    if (info.entryPoint === 'src/main.ts') urls.set('./app.js', url);
    if (info.entryPoint === 'public/style.css') urls.set('./style.css', url);
    for (const input of Object.keys(info.inputs)) {
      const path = input.startsWith('asset-url:') ? input.slice('asset-url:'.length) : resolve(root, input);
      if (path.startsWith(resolve(root, 'public') + '/') && extname(output) === extname(path)) {
        urls.set('./' + relative(resolve(root, 'public'), path), url);
      }
    }
  }
  // Retain unimported public files, such as attribution, under a content hash too.
  for (const path of await listFiles(resolve(root, 'public'))) {
    if (path === 'index.html' || urls.has('./' + path)) continue;
    const data = await readFile(resolve(root, 'public', path)), ext = extname(path);
    const name = `${basename(path, ext)}-${sha256(data).slice(0, 16)}${ext}`;
    await writeFile(resolve(destination, 'assets', name), data);
    urls.set('./' + path, './assets/' + name);
  }
  if (!urls.has('./app.js') || !urls.has('./style.css')) throw new Error('Build is missing the JS or CSS entry point');
  const html = (await readFile(resolve(root, 'public/index.html'), 'utf8')).replace(/\b(src|href)=(['"])(\.\/[^'"]+)\2/g, (match, attribute, quote, url) => {
    const hashed = urls.get(url);
    if (!hashed) throw new Error(`Unresolved public URL in index.html: ${url}`);
    return `${attribute}=${quote}${hashed}${quote}`;
  });
  await writeFile(resolve(destination, 'index.html'), html);
  // This local integrity receipt is never uploaded. Validate before publishing
  // anything, especially before a cleanup can remove old remote files.
  const files = {};
  for (const path of await listFiles(destination)) files[path] = sha256(await readFile(resolve(destination, path)));
  await writeFile(resolve(destination, '.build-manifest.json'), JSON.stringify({ version: 1, files }, null, 2) + '\n');
  await verifyBuild(destination);
  console.log(`Built and verified content-hashed static site → ${destination}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildSite();
