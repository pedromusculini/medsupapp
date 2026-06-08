import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import type { ClienteAtendimento, ClienteObservacao } from '@/lib/types';
import { isProntuarioObservacao } from '@/lib/prontuarioContent';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'medsupapp-dev-secret-key-change-in-production';

export const PRONTUARIO_COOKIE_NAME = 'prontuario_unlock';
export const PRONTUARIO_UNLOCK_SECONDS = 30 * 60;
export const PRONTUARIO_PIN_MIN = 4;
export const PRONTUARIO_PIN_MAX = 6;
export const PRONTUARIO_RECOVERY_CODE_LENGTH = 8;
export const PRONTUARIO_PIN_RESET_PURPOSE = 'prontuario_pin_reset';

export { PRONTUARIO_CLINICA_PREFIX, isProntuarioObservacao, stripProntuarioPrefix } from '@/lib/prontuarioContent';

const RECOVERY_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BCRYPT_ROUNDS = 10;

export type ProntuarioSegurancaRow = {
  owner_email: string;
  pin_hash: string | null;
  recovery_code_hash: string | null;
  modo_recepcao: boolean;
  pin_updated_at: string | null;
};

export type ProntuarioAccessStatus = {
  pinConfigured: boolean;
  unlocked: boolean;
  modoRecepcao: boolean;
  locked: boolean;
  unlockExpiresAt: string | null;
};

export function validatePinFormat(pin: string): string | null {
  const trimmed = pin.trim();
  if (!/^\d+$/.test(trimmed)) {
    return 'O PIN deve conter apenas números.';
  }
  if (trimmed.length < PRONTUARIO_PIN_MIN || trimmed.length > PRONTUARIO_PIN_MAX) {
    return `O PIN deve ter entre ${PRONTUARIO_PIN_MIN} e ${PRONTUARIO_PIN_MAX} dígitos.`;
  }
  return null;
}

export function generateRecoveryCode(): string {
  let code = '';
  for (let i = 0; i < PRONTUARIO_RECOVERY_CODE_LENGTH; i++) {
    code += RECOVERY_CHARSET[Math.floor(Math.random() * RECOVERY_CHARSET.length)];
  }
  return code;
}

export async function hashSecret(value: string): Promise<string> {
  return bcrypt.hash(value, BCRYPT_ROUNDS);
}

export async function verifySecret(value: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(value, hash);
}

export function signProntuarioUnlockCookie(ownerEmail: string): string {
  return jwt.sign(
    {
      email: ownerEmail.toLowerCase().trim(),
      type: 'prontuario_unlock',
    },
    JWT_SECRET,
    { expiresIn: PRONTUARIO_UNLOCK_SECONDS },
  );
}

export function readProntuarioUnlockFromRequest(
  req: NextRequest,
  ownerEmail: string,
): { valid: boolean; expiresAt: string | null } {
  const token = req.cookies.get(PRONTUARIO_COOKIE_NAME)?.value;
  if (!token) return { valid: false, expiresAt: null };

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      email?: string;
      type?: string;
      exp?: number;
    };
    const valid =
      payload.type === 'prontuario_unlock' &&
      payload.email === ownerEmail.toLowerCase().trim();
    const expiresAt =
      payload.exp != null ? new Date(payload.exp * 1000).toISOString() : null;
    return { valid, expiresAt };
  } catch {
    return { valid: false, expiresAt: null };
  }
}

export async function readProntuarioUnlockFromCookies(
  ownerEmail: string,
): Promise<{ valid: boolean; expiresAt: string | null }> {
  const jar = await cookies();
  const token = jar.get(PRONTUARIO_COOKIE_NAME)?.value;
  if (!token) return { valid: false, expiresAt: null };

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      email?: string;
      type?: string;
      exp?: number;
    };
    const valid =
      payload.type === 'prontuario_unlock' &&
      payload.email === ownerEmail.toLowerCase().trim();
    const expiresAt =
      payload.exp != null ? new Date(payload.exp * 1000).toISOString() : null;
    return { valid, expiresAt };
  } catch {
    return { valid: false, expiresAt: null };
  }
}

export async function getProntuarioSeguranca(
  ownerEmail: string,
): Promise<ProntuarioSegurancaRow | null> {
  const email = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('clinica_prontuario_seguranca')
    .select('owner_email, pin_hash, recovery_code_hash, modo_recepcao, pin_updated_at')
    .eq('owner_email', email)
    .maybeSingle();

  if (error) {
    console.error('[prontuarioAcesso] get:', error);
    return null;
  }
  return (data as ProntuarioSegurancaRow | null) ?? null;
}

export async function upsertProntuarioSeguranca(
  ownerEmail: string,
  patch: Partial<
    Pick<ProntuarioSegurancaRow, 'pin_hash' | 'recovery_code_hash' | 'modo_recepcao' | 'pin_updated_at'>
  >,
): Promise<ProntuarioSegurancaRow | null> {
  const email = ownerEmail.toLowerCase().trim();
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('clinica_prontuario_seguranca')
    .upsert(
      {
        owner_email: email,
        updated_at: now,
        ...patch,
      },
      { onConflict: 'owner_email' },
    )
    .select('owner_email, pin_hash, recovery_code_hash, modo_recepcao, pin_updated_at')
    .single();

  if (error) {
    console.error('[prontuarioAcesso] upsert:', error);
    throw new Error(error.message);
  }
  return data as ProntuarioSegurancaRow;
}

export async function buildProntuarioAccessStatus(
  ownerEmail: string,
  req?: NextRequest,
): Promise<ProntuarioAccessStatus> {
  const row = await getProntuarioSeguranca(ownerEmail);
  const pinConfigured = !!row?.pin_hash;
  const modoRecepcao = row?.modo_recepcao ?? false;
  const unlock = req
    ? readProntuarioUnlockFromRequest(req, ownerEmail)
    : await readProntuarioUnlockFromCookies(ownerEmail);
  const unlocked = unlock.valid;
  const locked =
    modoRecepcao || (pinConfigured && !unlocked);

  return {
    pinConfigured,
    unlocked,
    modoRecepcao,
    locked,
    unlockExpiresAt: unlocked ? unlock.expiresAt : null,
  };
}

type ClienteComProntuario = {
  atendimentos: ClienteAtendimento[];
  observacoes: ClienteObservacao[];
};

export function filterClienteDetalhe<T extends ClienteComProntuario>(cliente: T, locked: boolean): T {
  if (!locked) return cliente;
  return {
    ...cliente,
    atendimentos: cliente.atendimentos.map((a) => stripAtendimentoProntuario(a)),
    observacoes: cliente.observacoes.filter((o) => !isProntuarioObservacao(o.texto)),
  };
}

function stripAtendimentoProntuario(a: ClienteAtendimento): ClienteAtendimento {
  if (!a.observacoes) return a;
  return { ...a, observacoes: null };
}

export function extractProntuarioFromCliente(cliente: ClienteComProntuario): {
  atendimentos: ClienteAtendimento[];
  observacoes: ClienteObservacao[];
} {
  return {
    atendimentos: cliente.atendimentos.filter((a) => !!a.observacoes?.trim()),
    observacoes: cliente.observacoes.filter((o) => isProntuarioObservacao(o.texto)),
  };
}

export type ResetProntuarioSegurancaResult = {
  ok: boolean;
  email: string;
  hadPin: boolean;
  message: string;
};

/** Remove PIN, código de recuperação e desativa modo recepção (suporte admin). */
export async function resetProntuarioSeguranca(
  ownerEmail: string,
): Promise<ResetProntuarioSegurancaResult> {
  const email = ownerEmail.toLowerCase().trim();
  const row = await getProntuarioSeguranca(email);

  if (!row || (!row.pin_hash && !row.recovery_code_hash && !row.modo_recepcao)) {
    return {
      ok: false,
      email,
      hadPin: false,
      message: 'Nenhuma proteção de prontuário configurada para esta conta.',
    };
  }

  const hadPin = !!row.pin_hash;

  await upsertProntuarioSeguranca(email, {
    pin_hash: null,
    recovery_code_hash: null,
    modo_recepcao: false,
    pin_updated_at: null,
  });

  return {
    ok: true,
    email,
    hadPin,
    message:
      'PIN do prontuário removido. A clínica precisará definir nova senha em Perfil → Segurança do prontuário.',
  };
}
