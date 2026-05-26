import nodemailer from 'nodemailer';

const host = process.env.EMAIL_SERVER_HOST;
const port = Number(process.env.EMAIL_SERVER_PORT || '587');
const secure = process.env.EMAIL_SERVER_SECURE === 'true';
const user = process.env.EMAIL_SERVER_USER;
const pass = process.env.EMAIL_SERVER_PASS;
const from = process.env.EMAIL_FROM;

function createTransporter() {
  if (!host || !port || !user || !pass || !from) {
    throw new Error('Configuração de e-mail ausente. Verifique EMAIL_SERVER_* e EMAIL_FROM.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendVerificationEmail(email: string, code: string) {
  const transporter = createTransporter();
  const subject = 'Seu código de verificação MedSupAPP';
  const text = `Seu código de verificação MedSupAPP é ${code}. Ele expira em 5 minutos.`;
  const html = `
    <div style="font-family:system-ui, sans-serif; color:#111;">
      <h1 style="color:#1a7f37;">MedSupAPP</h1>
      <p>Seu código de verificação é <strong>${code}</strong>.</p>
      <p>Use-o em até 5 minutos para concluir seu cadastro no MedSupAPP.</p>
      <p>Se você não solicitou este código, ignore este e-mail.</p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: email,
    subject,
    text,
    html,
  });
}
