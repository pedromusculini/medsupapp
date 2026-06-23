import { supabaseAdmin } from '@/lib/supabaseClient';
import { GOOGLE_ACCESS_CODE_PURPOSE } from '@/lib/googleAccountAccess';
import { VERIFICATION_CODE_TTL_MINUTES } from '@/lib/constants';
import {
  consumeVerificationCodeMemory,
  isSupabaseTransportError,
  logVerificationMemoryFallback,
  putVerificationCodeMemory,
} from '@/lib/verificationCodesMemory';

const CODE_TTL_MS = VERIFICATION_CODE_TTL_MINUTES * 60 * 1000;

export function googleAccessCodeExpiredMessage(): string {
  return `Código inválido ou expirado (válido por ${VERIFICATION_CODE_TTL_MINUTES} minutos).`;
}

const EXPIRED_MESSAGE = googleAccessCodeExpiredMessage();

export const VERIFICATION_CODES_SETUP_HINT =
  'Execute no Supabase: npm run db:verification-codes (ou sql/verification_codes_schema.sql).';

function isVerificationCodesDbError(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    msg.includes('verification_codes') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

function shouldUseMemoryFallback(error: { message?: string; code?: string }): boolean {
  return isVerificationCodesDbError(error) || isSupabaseTransportError(error);
}

function storeGoogleAccessCodeInMemory(
  email: string,
  googleSub: string,
  code: string,
): void {
  putVerificationCodeMemory(
    email,
    GOOGLE_ACCESS_CODE_PURPOSE,
    code,
    googleSub,
    CODE_TTL_MS,
  );
  logVerificationMemoryFallback('googleVerificationCodes');
}

export async function storeGoogleAccessCode(
  email: string,
  googleSub: string,
  code: string,
): Promise<void> {
  try {
    const normalized = email.toLowerCase().trim();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    await supabaseAdmin
      .from('verification_codes')
      .update({ used: true })
      .eq('email', normalized)
      .eq('role', GOOGLE_ACCESS_CODE_PURPOSE)
      .eq('used', false);

    const { error } = await supabaseAdmin.from('verification_codes').insert({
      email: normalized,
      code,
      expires_at: expiresAt,
      used: false,
      role: GOOGLE_ACCESS_CODE_PURPOSE,
      plan: googleSub,
    });

    if (error) {
      console.error('[googleVerificationCodes] insert:', error);
      if (shouldUseMemoryFallback(error)) {
        storeGoogleAccessCodeInMemory(email, googleSub, code);
        return;
      }
      throw new Error(error.message || 'Não foi possível gerar o código.');
    }
  } catch (err) {
    if (err instanceof Error && isSupabaseTransportError(err)) {
      storeGoogleAccessCodeInMemory(email, googleSub, code);
      return;
    }
    throw err;
  }
}

export async function verifyGoogleAccessCode(
  email: string,
  googleSub: string,
  typedCode: string,
): Promise<{ valid: boolean; reason?: string }> {
  const normalized = email.toLowerCase().trim();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('verification_codes')
    .select('id, code, expires_at, plan')
    .eq('email', normalized)
    .eq('role', GOOGLE_ACCESS_CODE_PURPOSE)
    .eq('used', false)
    .eq('code', typedCode.trim())
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[googleVerificationCodes] verify:', error);
    if (shouldUseMemoryFallback(error)) {
      return consumeVerificationCodeMemory(
        email,
        GOOGLE_ACCESS_CODE_PURPOSE,
        typedCode,
        googleSub,
        EXPIRED_MESSAGE,
      );
    }
    return { valid: false, reason: 'Erro ao validar o código.' };
  }

  const row = rows?.[0];
  if (!row) {
    const fromMemory = consumeVerificationCodeMemory(
      email,
      GOOGLE_ACCESS_CODE_PURPOSE,
      typedCode,
      googleSub,
      EXPIRED_MESSAGE,
    );
    if (fromMemory.valid) return fromMemory;
    return { valid: false, reason: EXPIRED_MESSAGE };
  }

  if (row.plan && row.plan !== googleSub) {
    return { valid: false, reason: 'Código não corresponde a esta sessão.' };
  }

  await supabaseAdmin
    .from('verification_codes')
    .update({ used: true })
    .eq('id', row.id);

  return { valid: true };
}
