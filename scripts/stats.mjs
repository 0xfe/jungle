import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { listFiles } from './verify-build.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const codeExtensions = new Set(['.ts', '.js', '.mjs', '.cjs', '.css', '.html', '.sh']);

/** Physical lines, including comments; a final newline does not add an empty line. */
export function countLines(text) {
  const lines = text === '' ? [] : text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return { lines: lines.length, nonblank: lines.filter(line => line.trim() !== '').length };
}

/** Count only authored code in explicit directories, never dependencies or build output. */
async function codeStats(root, directory) {
  const paths = (await listFiles(resolve(root, directory))).filter(path => codeExtensions.has(extname(path)));
  const total = { files: paths.length, lines: 0, nonblank: 0 };
  for (const path of paths) {
    const counts = countLines(await readFile(resolve(root, directory, path), 'utf8'));
    total.lines += counts.lines;
    total.nonblank += counts.nonblank;
  }
  return total;
}

/** Logical file bytes, grouped by extension; do not follow symlinks outside the tree. */
export async function sizeStats(root, directory, excluded = []) {
  const files = [];
  const byExtension = {};
  for (const path of await listFiles(resolve(root, directory))) {
    if (excluded.includes(path)) continue;
    const { size: bytes } = await stat(resolve(root, directory, path));
    const extension = extname(path) || '(none)';
    const group = byExtension[extension] ??= { files: 0, bytes: 0 };
    group.files++;
    group.bytes += bytes;
    files.push({ path: `${directory}/${path}`, bytes });
  }
  files.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  return {
    files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    byExtension, largest: files.slice(0, 8),
  };
}

/** Assemble a report from the build and coverage run performed by npm run stats. */
export async function collectStats(root = projectRoot) {
  const code = {};
  for (const directory of ['src', 'tests', 'scripts', 'public']) code[directory] = await codeStats(root, directory);
  code['upload.sh'] = { files: 1, ...countLines(await readFile(resolve(root, 'upload.sh'), 'utf8')) };
  code.total = Object.values(code).reduce((sum, group) => ({
    files: sum.files + group.files, lines: sum.lines + group.lines, nonblank: sum.nonblank + group.nonblank,
  }), { files: 0, lines: 0, nonblank: 0 });

  const sizes = {};
  for (const directory of ['assets', 'public/assets', 'dist']) {
    sizes[directory] = await sizeStats(root, directory, ['.build-manifest.json']);
  }
  const bundles = [];
  for (const path of await listFiles(resolve(root, 'dist'))) {
    if (!['.js', '.css'].includes(extname(path))) continue;
    const data = await readFile(resolve(root, 'dist', path));
    bundles.push({ path: `dist/${path}`, bytes: data.length, gzipBytes: gzipSync(data).length });
  }
  const manifest = JSON.parse(await readFile(resolve(root, 'public/assets/jungle.json'), 'utf8'));
  const atlas = {
    width: manifest.width, height: manifest.height,
    decodedBytes: manifest.width * manifest.height * 4,
    budgetBytes: 4096 * 4096 * 4,
    sprites: Object.keys(manifest.sprites).length,
    frames: Object.values(manifest.sprites).reduce((sum, sprite) => sum + sprite.frames.length, 0),
  };
  const coverage = JSON.parse(await readFile(resolve(root, 'coverage/coverage-summary.json'), 'utf8'));
  if (!coverage.total?.lines || Object.keys(coverage).length < 2) {
    throw new Error('No source coverage found. Run npm run stats to rebuild and collect coverage.');
  }
  return {
    version: 1, generatedAt: new Date().toISOString(), code, sizes, bundles, atlas,
    coverage: { files: Object.keys(coverage).length - 1, ...coverage.total },
  };
}

/** Binary units describe storage/decoded memory; gzip sizes are estimates, not live transfers. */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
}

function printStats(report) {
  console.log('\nJungle project statistics\n');
  console.log('Authored code (physical lines; nonblank includes comments)');
  console.table(report.code);
  console.log(`Headless test coverage (${report.coverage.files} source files, including untested files)`);
  console.table(Object.fromEntries(['lines', 'statements', 'functions', 'branches'].map(metric => {
    const { covered, total, pct } = report.coverage[metric];
    return [metric, { covered, total, percent: `${pct}%` }];
  })));
  console.log('File sizes (separate inventories; dist includes source maps, excludes local build receipt)');
  console.table(Object.fromEntries(Object.entries(report.sizes).map(([directory, group]) => [directory, {
    files: group.files, size: formatBytes(group.bytes),
  }])));
  console.log('Built JS/CSS (gzip estimates, excluding source maps)');
  console.table(report.bundles.map(file => ({ path: file.path, size: formatBytes(file.bytes), gzip: formatBytes(file.gzipBytes) })));
  console.log('Largest deployed files');
  console.table(report.sizes.dist.largest.map(file => ({ path: file.path, size: formatBytes(file.bytes) })));
  const atlas = report.atlas;
  console.log(`Atlas: ${atlas.width} × ${atlas.height}, ${atlas.sprites} sprites, ${atlas.frames} frame references`);
  console.log(`Decoded RGBA: ${formatBytes(atlas.decodedBytes)} / ${formatBytes(atlas.budgetBytes)} budget`);
  console.log('\nJSON: artifacts/stats.json\nCoverage: coverage/index.html\nLCOV: coverage/lcov.info');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await collectStats();
    await mkdir(resolve(projectRoot, 'artifacts'), { recursive: true });
    await writeFile(resolve(projectRoot, 'artifacts/stats.json'), JSON.stringify(report, null, 2) + '\n');
    printStats(report);
  } catch (error) {
    console.error(`Stats failed: ${error.message}\nRun npm run stats to build assets and collect fresh coverage.`);
    process.exitCode = 1;
  }
}
