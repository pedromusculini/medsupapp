/**
 * Fluxo completo: push master → aguardar Vercel Ready → promote www.
 * Uso: npm run release
 */
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const noPush = process.argv.includes('--no-push');

try {
  if (!noPush) {
    console.log('📤 git push origin master …\n');
    execSync('git push origin master', { stdio: 'inherit', cwd: root });
  }

  console.log('\n🌐 Promovendo domínio (aguarda build se necessário)…\n');
  execSync('node scripts/promote-production-domain.mjs --wait', {
    stdio: 'inherit',
    cwd: root,
  });
} catch (err) {
  process.exit(typeof err.status === 'number' ? err.status : 1);
}
