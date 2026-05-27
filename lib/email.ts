import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

function getResend() {
  if (!resendApiKey) {
    console.warn('[email] RESEND_API_KEY não configurada. Usando modo fallback (console).');
    return null;
  }
  return new Resend(resendApiKey);
}

export async function sendVerificationEmail(email: string, code: string) {
  const resend = getResend();

  const subject = 'Seu código de verificação MedSupAPP';
  const html = `
    <div style="font-family:system-ui, sans-serif; max-width:480px; margin:0 auto;">
      <div style="background:#013a01; padding:24px; text-align:center; border-radius:12px 12px 0 0;">
        <h1 style="color:#fff; margin:0; font-size:24px;">🩺 MedSupAPP</h1>
      </div>
      <div style="background:#fff; border:1px solid #e5e7eb; border-top:0; padding:32px; border-radius:0 0 12px 12px;">
        <h2 style="color:#111; margin:0 0 16px;">Seu código de verificação</h2>
        <p style="color:#6b7280; margin:0 0 24px; font-size:16px;">
          Use o código abaixo para verificar seu e-mail e ativar seu cadastro:
        </p>
        <div style="background:#f3f4f6; border-radius:12px; padding:24px; text-align:center; margin:0 0 24px;">
          <span style="font-size:48px; font-weight:bold; letter-spacing:12px; color:#013a01;">${code}</span>
        </div>
        <p style="color:#9ca3af; font-size:14px; margin:0 0 8px;">
          Código válido por 5 minutos.
        </p>
        <p style="color:#9ca3af; font-size:14px; margin:0;">
          Se você não solicitou este código, ignore este e-mail.
        </p>
      </div>
      <div style="text-align:center; padding:16px; color:#9ca3af; font-size:12px;">
        <p style="margin:0;">© 2026 MedSupAPP. Todos os direitos reservados.</p>
      </div>
    </div>
  `;

  // Modo fallback - exibe no console
  if (!resend) {
    console.log(`[EMAIL FALLBACK] Para: ${email} | Código: ${code} | De: MedSupAPP <naoresponda@medsupapp.com.br>`);
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'MedSupAPP <naoresponda@medsupapp.com.br>',
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error('[email] Erro Resend:', error);
      throw error;
    }

    console.log(`[email] E-mail enviado para ${email}:`, data?.id);
  } catch (error) {
    console.error('[email] Erro ao enviar e-mail:', error);
    throw error;
  }
}