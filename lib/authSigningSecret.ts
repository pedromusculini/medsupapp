/**
 * Segredo único para assinatura JWT (prontuário, registro legado, etc.).
 * Em produção não há fallback — build e runtime falham sem variável configurada.
 */

const DEV_FALLBACK = 'medsupapp-dev-secret-key-change-in-production';

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Lê o segredo das envs aceitas (ordem de prioridade). */
export function resolveAuthSigningSecretFromEnv(): string | null {
  const secret =
    process.env.JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim();
  return secret || null;
}

export function isAuthSigningSecretConfigured(): boolean {
  return resolveAuthSigningSecretFromEnv() != null;
}

/**
 * Versão do segredo — incremente em AUTH_SECRET_VERSION ao rotacionar
 * para invalidar cookies JWT já emitidos (ex.: prontuario_unlock).
 */
export function getAuthSecretVersion(): string {
  return (
    process.env.AUTH_SECRET_VERSION?.trim() ||
    process.env.JWT_SECRET_VERSION?.trim() ||
    '1'
  );
}

/** Segredo para assinar/verificar JWT. Em produção, ausência → erro. */
export function getAuthSigningSecret(): string {
  const secret = resolveAuthSigningSecretFromEnv();
  if (secret) return secret;
  if (!isProductionEnv()) return DEV_FALLBACK;
  throw new Error(
    'AUTH_SECRET (ou JWT_SECRET / NEXTAUTH_SECRET) é obrigatório em produção.',
  );
}

/** Falha cedo no build/deploy se produção sem segredo. */
export function assertAuthSigningSecretForProduction(): void {
  if (!isProductionEnv()) return;
  getAuthSigningSecret();
}
