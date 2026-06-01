import { supabaseAdmin } from '@/lib/supabaseClient';
import { activateFromPayment, expireAssinatura } from '@/lib/assinatura';
import type { AsaasWebhookPayload } from '@/lib/asaasWebhook';

function resolveOwnerEmail(body: AsaasWebhookPayload): string | null {
  const ref =
    body.payment?.externalReference?.trim() ||
    body.subscription?.externalReference?.trim();
  if (ref && ref.includes('@')) return ref.toLowerCase();
  return null;
}

export async function processAsaasWebhook(
  body: AsaasWebhookPayload,
  rawPayload: unknown,
): Promise<{ handled: boolean; ownerEmail?: string }> {
  const eventId = (body as { id?: string }).id;
  const event = body.event ?? '';
  const ownerEmail = resolveOwnerEmail(body);

  if (eventId) {
    const { error: insErr } = await supabaseAdmin
      .from('assinaturas_webhook_events')
      .insert({
        asaas_event_id: eventId,
        event_type: event,
        owner_email: ownerEmail,
        asaas_payment_id: body.payment?.id ?? null,
        payload: rawPayload as Record<string, unknown>,
      });
    if (insErr?.code === '23505') {
      return { handled: true, ownerEmail: ownerEmail ?? undefined };
    }
    if (insErr) throw insErr;
  }

  if (!ownerEmail) {
    console.warn('[asaasWebhook] Sem externalReference (e-mail):', event);
    return { handled: false };
  }

  switch (event) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
      await activateFromPayment({
        ownerEmail,
        paymentId: body.payment?.id ?? eventId ?? 'unknown',
        dueDate: body.payment?.dueDate ?? null,
        customerId: body.payment?.customer ?? null,
        subscriptionId: body.payment?.subscription ?? null,
      });
      return { handled: true, ownerEmail };

    case 'PAYMENT_OVERDUE':
      await expireAssinatura(ownerEmail);
      return { handled: true, ownerEmail };

    case 'SUBSCRIPTION_INACTIVATED':
    case 'SUBSCRIPTION_DELETED':
      await expireAssinatura(ownerEmail);
      return { handled: true, ownerEmail };

    default:
      return { handled: false, ownerEmail };
  }
}
