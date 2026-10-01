import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countLines, sizeStats } from '../scripts/stats.mjs';

test('line counts handle empty files, final newlines, comments and mixed line endings', () => {
  assert.deepEqual(countLines(''), { lines: 0, nonblank: 0 });
  assert.deepEqual(countLines('\n'), { lines: 1, nonblank: 0 });
  assert.deepEqual(countLines('// comment\r\n \r\ncode\rnext\n'), { lines: 4, nonblank: 3 });
  assert.deepEqual(countLines('code'), { lines: 1, nonblank: 1 });
});

test('size inventories count bytes, exclude receipts, rank files and reject symlinks', async t => {
  const root = await mkdtemp(join(tmpdir(), 'jungle-stats-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist/nested'), { recursive: true });
  await writeFile(join(root, 'dist/nested/a.txt'), '🌳');
  await writeFile(join(root, 'dist/b.png'), Buffer.alloc(10));
  await writeFile(join(root, 'dist/.build-manifest.json'), '{}');
  const result = await sizeStats(root, 'dist', ['.build-manifest.json']);
  assert.equal(result.files, 2);
  assert.equal(result.bytes, 14);
  assert.deepEqual(result.byExtension['.txt'], { files: 1, bytes: 4 });
  assert.deepEqual(result.largest.map(file => file.path), ['dist/b.png', 'dist/nested/a.txt']);
  await symlink(join(root, 'dist/b.png'), join(root, 'dist/link.png'));
  await assert.rejects(sizeStats(root, 'dist'), /Unsupported build entry/);
});
