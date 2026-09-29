import { execFileSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from './verify-build.mjs';

/** Stable metadata keeps identical source builds byte-for-byte reproducible. */
export async function buildInfo(root) {
  const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const configSha256 = sha256(await readFile(resolve(root, 'src/config.ts')));
  const info = { version, revision: null, committedAt: null, modified: null, configSha256 };
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    // A source archive nested in another checkout must not inherit that checkout's identity.
    if (await realpath(git('rev-parse', '--show-toplevel')) !== await realpath(root)) return info;
    const [revision, committedAt] = git('show', '-s', '--format=%H%n%cI', 'HEAD').split('\n');
    return { ...info, revision, committedAt, modified: git('status', '--porcelain', '--untracked-files=normal') !== '' };
  } catch {
    // Git is optional for source archives; unknown is more useful than an invented revision.
    return info;
  }
}
