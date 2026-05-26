const CODE_TTL_MS = 5 * 60 * 1000;

type StoredCode = {
  code: string;
  expiresAt: number;
};

const codeStore = new Map<string, StoredCode>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanupExpired() {
  const now = Date.now();
  for (const [email, entry] of codeStore.entries()) {
    if (entry.expiresAt <= now) {
      codeStore.delete(email);
    }
  }
}

export function storeVerificationCode(email: string, code: string) {
  cleanupExpired();
  codeStore.set(normalizeEmail(email), {
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
  });
}

export function verifyStoredCode(email: string, typedCode: string) {
  cleanupExpired();
  const normalized = normalizeEmail(email);
  const entry = codeStore.get(normalized);

  if (!entry) {
    return { valid: false, reason: 'O código expirou ou não foi encontrado. Gere um novo.' };
  }

  if (entry.code !== typedCode) {
    return { valid: false, reason: 'Código incorreto. Verifique os dígitos e tente novamente.' };
  }

  codeStore.delete(normalized);
  return { valid: true };
}
