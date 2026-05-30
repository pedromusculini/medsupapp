/**
 * Após git push: aponta www e apex para o deployment Production mais recente.
 * Uso: npm run deploy:promote
 * Requer: vercel CLI logado (npx vercel login)
 */
import { execSync } from 'child_process';

const DOMAINS = [
  'www.medsupapp.com.br',
  'medsupapp.com.br',
  'medsupapp-pedromusculini-pedro-henrique-musculini-s-projects.vercel.app',
];

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
}

try {
  const list = run('npx vercel ls medsupapp 2>&1');
  const match = list.match(
    /https:\/\/(medsupapp-[a-z0-9]+-pedro-henrique-musculini-s-projects\.vercel\.app)\s+●\s+Ready\s+Production/,
  );
  if (!match) {
    console.error('❌ Nenhum deployment Production Ready encontrado. Aguarde o build na Vercel.');
    process.exit(1);
  }
  const deploymentUrl = `https://${match[1]}`;
  console.log(`📦 Deploy mais recente: ${deploymentUrl}`);

  for (const domain of DOMAINS) {
    run(`npx vercel alias set ${deploymentUrl} ${domain}`);
    console.log(`✅ ${domain}`);
  }

  console.log('\nPronto. Teste em aba anônima: https://www.medsupapp.com.br');
} catch (err) {
  console.error('❌ Erro:', err.message || err);
  process.exit(1);
}
