/**
 * Utilitários WhatsApp semi-manual (links api.whatsapp.com + deep links mobile).
 */

export function normalizeBrazilPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

export type WhatsAppUrls = {
  /** HTTPS universal link — desktop e fallback */
  web: string;
  /** Deep link whatsapp:// — iOS e fallback Android */
  app: string;
  /** Intent Android — WhatsApp Business com fallback whatsapp:// */
  android: string;
};

function whatsAppSendParams(phone: string | null | undefined, message: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set('text', message);
  if (phone?.trim()) {
    params.set('phone', normalizeBrazilPhone(phone));
  }
  return params;
}

/**
 * URL HTTPS para abrir WhatsApp (api.whatsapp.com).
 * Sem telefone: abre seletor de contato (ideal para compartilhar link).
 */
export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const params = whatsAppSendParams(phone, message);
  return `https://api.whatsapp.com/send?${params.toString()}`;
}

/** Deep link whatsapp:// — use no mobile com fallback para {@link buildWhatsAppUrl}. */
export function buildWhatsAppAppUrl(phone: string | null | undefined, message: string): string {
  const params = whatsAppSendParams(phone, message);
  return `whatsapp://send?${params.toString()}`;
}

/**
 * Intent URL Android — abre WhatsApp Business (com.whatsapp.w4b) direto no Chrome.
 * Se não instalado, fallback para whatsapp:// (app regular).
 */
export function buildWhatsAppAndroidIntentUrl(
  phone: string | null | undefined,
  message: string,
): string {
  const params = whatsAppSendParams(phone, message);
  const query = params.toString();
  const appFallback = encodeURIComponent(buildWhatsAppAppUrl(phone, message));
  return (
    `intent://send?${query}#Intent;` +
    `scheme=whatsapp;package=com.whatsapp.w4b;` +
    `S.browser_fallback_url=${appFallback};end`
  );
}

export function buildWhatsAppUrls(
  phone: string | null | undefined,
  message: string,
): WhatsAppUrls {
  return {
    web: buildWhatsAppUrl(phone, message),
    app: buildWhatsAppAppUrl(phone, message),
    android: buildWhatsAppAndroidIntentUrl(phone, message),
  };
}

export function buildFormularioWhatsAppMessage(params: {
  nomeClinica?: string;
  nomePaciente?: string;
  link: string;
}): string {
  const clinica = params.nomeClinica ? `${params.nomeClinica}` : 'sua clínica';
  const saudacao = params.nomePaciente
    ? `Olá, ${params.nomePaciente}!`
    : 'Olá!';
  return `${saudacao}\n\n${clinica} enviou um link para você preencher seus dados (leva menos de 2 minutos):\n\n${params.link}\n\nObrigado!`;
}

export function buildAutocadastroWhatsAppMessage(params: {
  nomeClinica?: string;
  link: string;
}): string {
  const clinica = params.nomeClinica || 'nossa clínica';
  return (
    `Olá! Você recebeu um link para fazer seu cadastro em ${clinica}.\n\n` +
    `Preencha seus dados pelo link (leva menos de 2 minutos):\n${params.link}\n\n` +
    `Obrigado!`
  );
}

/** Pedido ao médico para autorizar Google Calendar via link OAuth. */
export function buildPedidoAcessoAgendaWhatsAppMessage(params: {
  nomeMedico: string;
  nomeClinica?: string;
  linkConvite: string;
}): string {
  const clinica = params.nomeClinica?.trim() || 'Nossa clínica';
  const nome = params.nomeMedico.trim() || 'profissional';
  const link = params.linkConvite.trim();

  return (
    `Olá, ${nome}!\n\n` +
    `${clinica} usa o MedSupAPP para organizar as consultas. Para conectarmos sua agenda ao sistema, autorize o acesso à sua agenda Google.\n\n` +
    `Abra o link abaixo e toque em "Autorizar agenda Google":\n${link}\n\n` +
    `Isso compartilha somente a agenda — não inclui Drive, e-mails nem outros dados.\n\n` +
    `O link vale por 7 dias. Se tiver dúvidas, responda esta mensagem.\n\nObrigado!`
  );
}
