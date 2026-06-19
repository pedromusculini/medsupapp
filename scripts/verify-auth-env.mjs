/**
 * Verifica variáveis de auth obrigatórias antes do build em produção.
 * Uso: node scripts/verify-auth-env.mjs (hook em npm run build / vercel-build)
 */

const isProd =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.VERCEL === '1';

function has(key) {
  return Boolean(process.env[key]?.trim());
}

const signingSecret =
  process.env.JWT_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim();

const sessionSecret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

if (!isProd) {
  if (!signingSecret) {
    console.warn(
      '[verify-auth-env] Dev: AUTH_SECRET/JWT_SECRET ausente — usando fallback local apenas em desenvolvimento.',
    );
  }
  process.exit(0);
}

const errors = [];

if (!signingSecret) {
  errors.push(
    'Defina AUTH_SECRET (recomendado) ou JWT_SECRET / NEXTAUTH_SECRET na Vercel.',
  );
}

if (!sessionSecret) {
  errors.push('AUTH_SECRET ou NEXTAUTH_SECRET é obrigatório para NextAuth em produção.');
}

if (!has('GOOGLE_CLIENT_ID') || !has('GOOGLE_CLIENT_SECRET')) {
  errors.push('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET são obrigatórios em produção.');
}

if (errors.length > 0) {
  console.error('[verify-auth-env] Falha — configuração de produção incompleta:\n');
  for (const e of errors) console.error(`  • ${e}`);
  console.error(
    '\nApós rotacionar o segredo, incremente AUTH_SECRET_VERSION para invalidar cookies JWT antigos.',
  );
  process.exit(1);
}

console.log('[verify-auth-env] OK — segredos de auth presentes.');
