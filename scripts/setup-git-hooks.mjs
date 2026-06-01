/**
 * Ativa .githooks/ (post-push → deploy:promote --wait no master).
 * Roda automaticamente em npm install via "prepare".
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

if (
  process.env.CI === 'true' ||
  process.env.VERCEL === '1' ||
  !existsSync(join(root, '.git'))
) {
  process.exit(0);
}

let current = '';
try {
  current = execSync('git config core.hooksPath', {
    encoding: 'utf8',
    cwd: root,
  }).trim();
} catch {
  /* not set */
}

if (current !== '.githooks') {
  execSync('git config core.hooksPath .githooks', { cwd: root });
  console.log(
    '✅ Git hooks: .githooks (post-push em master → npm run deploy:promote --wait)',
  );
}
