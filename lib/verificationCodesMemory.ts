export type VerificationCodeMemoryEntry = {
  code: string;
  meta: string;
  expiresAt: number;
  used: boolean;
};

const store = new Map<string, VerificationCodeMemoryEntry>();

export function memoryStoreKey(email: string, role: string): string {
  return `${email.toLowerCase().trim()}:${role}`;
}

export function putVerificationCodeMemory(
  email: string,
  role: string,
  code: string,
  meta: string,
  ttlMs: number,
): void {
  store.set(memoryStoreKey(email, role), {
    code,
    meta,
    expiresAt: Date.now() + ttlMs,
    used: false,
  });
}

export function consumeVerificationCodeMemory(
  email: string,
  role: string,
  typedCode: string,
  meta: string,
  expiredMessage: string,
): { valid: boolean; reason?: string } {
  const key = memoryStoreKey(email, role);
  const entry = store.get(key);
  if (!entry || entry.used) {
    return { valid: false, reason: expiredMessage };
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return { valid: false, reason: expiredMessage };
  }
  if (entry.code !== typedCode.trim()) {
    return { valid: false, reason: expiredMessage };
  }
  if (entry.meta && entry.meta !== meta) {
    return { valid: false, reason: 'Código não corresponde a esta sessão.' };
  }
  entry.used = true;
  return { valid: true };
}

export function isSupabaseTransportError(error: { message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('network')
  );
}

export function logVerificationMemoryFallback(scope: string): void {
  const suffix =
    process.env.NODE_ENV === 'production'
      ? 'configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'
      : 'veja o código no log do servidor se o e-mail não chegar.';
  console.warn(`[${scope}] Supabase indisponível — código em memória (${suffix})`);
}
