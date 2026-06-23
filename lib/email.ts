import { Resend } from 'resend';
import {
  VERIFICATION_CODE_DIGITS,
  VERIFICATION_CODE_TTL_MINUTES,
  VERIFICATION_EMAIL_FROM_DISPLAY,
} from '@/lib/constants';

const resendApiKey = process.env.RESEND_API_KEY;
const DEFAULT_FROM = `MedSupAPP <${VERIFICATION_EMAIL_FROM_DISPLAY}>`;

/** Ignora placeholders (ex. noreply@yourdomain.com) deixados no Vercel por engano. */
function resolveResendFromAddress(): string {
  const raw = process.env.RESEND_FROM?.trim();
  if (!raw) return DEFAULT_FROM;
  const email = (raw.match(/<([^>]+)>/)?.[1] ?? raw).toLowerCase();
  if (
    email.includes('yourdomain.com') ||
    email.includes('example.com') ||
    email.endsWith('@localhost')
  ) {
    console.warn(
      `[email] RESEND_FROM inválido (${raw}); usando padrão ${DEFAULT_FROM}`,
    );
    return DEFAULT_FROM;
  }
  return raw;
}

const fromAddress = resolveResendFromAddress();

export type SendVerificationEmailResult = {
  id: string;
};

function getResend(): Resend {
  if (!resendApiKey?.trim()) {
    throw new Error(
      'RESEND_API_KEY não está configurada. Adicione no .env.local (local) ou nas variáveis do Vercel (produção).',
    );
  }
  return new Resend(resendApiKey);
}

export function getEmailFromAddress(): string {
  return fromAddress;
}

/** Endereço puro para exibir na UI (extrai de `Nome <email@dominio>`). */
export function formatEmailSenderForDisplay(from = fromAddress): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

function resendConfigHint(): string {
  return `Verifique RESEND_API_KEY e RESEND_FROM (${formatEmailSenderForDisplay()}) no domínio verificado no Resend.`;
}

export async function sendVerificationEmail(
  email: string,
  code: string,
): Promise<SendVerificationEmailResult> {
  const to = email.toLowerCase().trim();

  if (!resendApiKey?.trim()) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[email] DEV (sem RESEND_API_KEY): código para ${to}: ${code}`);
      return { id: 'dev-no-resend' };
    }
    throw new Error(
      'RESEND_API_KEY não está configurada. Adicione no .env.local (local) ou nas variáveis do Vercel (produção).',
    );
  }

  const resend = getResend();
  const sender = formatEmailSenderForDisplay();

  const subject = 'Seu código de verificação MedSupAPP';
  const text = [
    'MedSupAPP — código de verificação',
    '',
    `Use o código de ${VERIFICATION_CODE_DIGITS} dígitos abaixo para confirmar seu e-mail após entrar com Google:`,
    '',
    code,
    '',
    `Válido por ${VERIFICATION_CODE_TTL_MINUTES} minutos.`,
    `Enviado por ${sender}. Se você não solicitou, ignore este e-mail.`,
  ].join('\n');

  const html = `
    <div style="font-family:system-ui, sans-serif; max-width:480px; margin:0 auto;">
      <div style="background:#047857; padding:24px; text-align:center; border-radius:12px 12px 0 0;">
        <h1 style="color:#fff; margin:0; font-size:24px;">MedSupAPP</h1>
      </div>
      <div style="background:#fff; border:1px solid #e5e7eb; border-top:0; padding:32px; border-radius:0 0 12px 12px;">
        <h2 style="color:#111; margin:0 0 16px;">Seu código de verificação</h2>
        <p style="color:#6b7280; margin:0 0 24px; font-size:16px;">
          Use o código de ${VERIFICATION_CODE_DIGITS} dígitos abaixo para confirmar seu e-mail após entrar com Google:
        </p>
        <div style="background:#f3f4f6; border-radius:12px; padding:24px; text-align:center; margin:0 0 24px;">
          <span style="font-size:48px; font-weight:bold; letter-spacing:12px; color:#047857;">${code}</span>
        </div>
        <p style="color:#9ca3af; font-size:14px; margin:0 0 8px;">
          Código válido por ${VERIFICATION_CODE_TTL_MINUTES} minutos.
        </p>
        <p style="color:#9ca3af; font-size:14px; margin:0;">
          Enviado por ${sender}. Se você não solicitou, ignore este e-mail.
        </p>
      </div>
      <div style="text-align:center; padding:16px; color:#9ca3af; font-size:12px;">
        <p style="margin:0;">© 2026 MedSupAPP. Todos os direitos reservados.</p>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    console.error('[email] Erro Resend:', error);
    const detail = error.message?.trim();
    throw new Error(
      detail
        ? `${detail} — ${resendConfigHint()}`
        : `Falha ao enviar e-mail pelo Resend. ${resendConfigHint()}`,
    );
  }

  const id = data?.id ?? 'unknown';
  console.log(`[email] Enviado para ${to} (resend_id: ${id})`);
  return { id };
}
