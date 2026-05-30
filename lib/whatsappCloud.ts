import { getWhatsAppCloudConfig } from '@/lib/whatsappConfig';
import { normalizeBrazilPhone } from '@/lib/whatsapp';
import { buildConfirmButtonId } from '@/lib/whatsappConversa';

export type WhatsAppSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; code?: string };

type TemplateComponent = {
  type: 'body';
  parameters: { type: 'text'; text: string }[];
};

function graphUrl(phoneNumberId: string, apiVersion: string): string {
  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
}

function parseGraphError(body: unknown): string {
  const err = body as {
    error?: { message?: string; code?: number; type?: string };
  };
  return err?.error?.message || 'Erro desconhecido na API WhatsApp';
}

/** Envia template aprovado pela Meta (mensagem iniciada pelo negócio). */
export async function sendTemplateMessage(
  toPhone: string,
  templateName: string,
  bodyParameters: string[],
  languageCode = 'pt_BR',
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppCloudConfig();
  if (!config) {
    return {
      ok: false,
      error:
        'WhatsApp Cloud API não configurada. Defina WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_VERIFY_TOKEN.',
    };
  }

  const to = normalizeBrazilPhone(toPhone);
  const components: TemplateComponent[] = [];
  if (bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParameters.map((text) => ({ type: 'text', text: String(text).slice(0, 1024) })),
    });
  }

  const res = await fetch(graphUrl(config.phoneNumberId, config.apiVersion), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length ? { components } : {}),
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: parseGraphError(data), code: String(res.status) };
  }

  const messageId = (data as { messages?: { id: string }[] })?.messages?.[0]?.id;
  if (!messageId) {
    return { ok: false, error: 'Resposta da Meta sem message id' };
  }
  return { ok: true, messageId };
}

/** Texto livre — só válido dentro da janela de 24h após mensagem do usuário. */
export async function sendTextMessage(
  toPhone: string,
  text: string,
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppCloudConfig();
  if (!config) {
    return { ok: false, error: 'WhatsApp Cloud API não configurada.' };
  }

  const to = normalizeBrazilPhone(toPhone);
  const res = await fetch(graphUrl(config.phoneNumberId, config.apiVersion), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text.slice(0, 4096) },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: parseGraphError(data), code: String(res.status) };
  }

  const messageId = (data as { messages?: { id: string }[] })?.messages?.[0]?.id;
  if (!messageId) {
    return { ok: false, error: 'Resposta da Meta sem message id' };
  }
  return { ok: true, messageId };
}

/** Botões Confirmar / Cancelar (janela 24h ou resposta a template). */
export async function sendInteractiveConfirmButtons(
  toPhone: string,
  consultaId: string,
  bodyText = 'Confirma sua presença na consulta?',
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppCloudConfig();
  if (!config) {
    return { ok: false, error: 'WhatsApp Cloud API não configurada.' };
  }

  const to = normalizeBrazilPhone(toPhone);

  const res = await fetch(graphUrl(config.phoneNumberId, config.apiVersion), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText.slice(0, 1024) },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: buildConfirmButtonId('confirmar', consultaId),
                title: 'Confirmar',
              },
            },
            {
              type: 'reply',
              reply: {
                id: buildConfirmButtonId('cancelar', consultaId),
                title: 'Cancelar',
              },
            },
          ],
        },
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: parseGraphError(data), code: String(res.status) };
  }

  const messageId = (data as { messages?: { id: string }[] })?.messages?.[0]?.id;
  if (!messageId) {
    return { ok: false, error: 'Resposta da Meta sem message id' };
  }
  return { ok: true, messageId };
}
