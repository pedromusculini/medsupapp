export type WhatsAppCloudConfig = {
  token: string;
  phoneNumberId: string;
  verifyToken: string;
  apiVersion: string;
  businessAccountId?: string;
  templates: {
    formularioLink: string | null;
    lembreteConsulta: string | null;
    formularioRecebido: string | null;
    confirmacaoPagamento: string | null;
  };
};

export function getWhatsAppCloudConfig(): WhatsAppCloudConfig | null {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (!token || !phoneNumberId || !verifyToken) {
    return null;
  }

  return {
    token,
    phoneNumberId,
    verifyToken,
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim(),
    templates: {
      formularioLink:
        process.env.WHATSAPP_TEMPLATE_FORMULARIO_LINK?.trim() || null,
      lembreteConsulta:
        process.env.WHATSAPP_TEMPLATE_LEMBRETE_CONSULTA?.trim() || null,
      formularioRecebido:
        process.env.WHATSAPP_TEMPLATE_FORMULARIO_RECEBIDO?.trim() || null,
      confirmacaoPagamento:
        process.env.WHATSAPP_TEMPLATE_CONFIRMACAO_PAGAMENTO?.trim() || null,
    },
  };
}

export function isWhatsAppCloudConfigured(): boolean {
  return getWhatsAppCloudConfig() !== null;
}
