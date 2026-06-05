import { PLANOS } from '@/lib/constants';
import { loadPlanCatalog } from '@/lib/planCatalog';
import {
  asaasRequest,
  isAsaasApiConfigured,
  type AsaasPayment,
  type AsaasListResponse,
} from '@/lib/asaasApi';
import { getAssinaturaRow, ensureAssinaturaRecord } from '@/lib/assinatura';
import { resolveAndPersistBillingValue } from '@/lib/priceLock';
import { supabaseAdmin } from '@/lib/supabaseClient';

const PENDING_STATUSES = new Set(['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS']);

/** Sincroniza plano/descrição no Asaas respeitando bloqueio de preço de 12 meses. */
export async function syncAsaasSubscriptionPlan(
  ownerEmail: string,
  plano: string,
  options?: { forceNewLock?: boolean },
): Promise<void> {
  const email = ownerEmail.toLowerCase().trim();
  await loadPlanCatalog();
  const row = await getAssinaturaRow(email);
  const valor = await resolveAndPersistBillingValue(email, plano, row, options);

  await supabaseAdmin
    .from('assinaturas')
    .update({ plano, updated_at: new Date().toISOString() })
    .eq('owner_email', email);

  if (!isAsaasApiConfigured()) return;

  const updated = await getAssinaturaRow(email);
  if (!updated?.asaas_subscription_id) return;

  await asaasRequest(`/subscriptions/${updated.asaas_subscription_id}`, {
    method: 'PUT',
    body: JSON.stringify({
      value: valor,
      description: `MedSupAPP — ${PLANOS[plano as keyof typeof PLANOS]?.nome ?? plano}`,
    }),
  });
}

function pickPaymentUrl(pay: AsaasPayment): string | null {
  return pay.invoiceUrl || pay.bankSlipUrl || null;
}

async function listSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  const res = await asaasRequest<AsaasListResponse<AsaasPayment>>(
    `/subscriptions/${subscriptionId}/payments?limit=24`,
  );
  return res.data ?? [];
}

async function ensureAsaasCustomer(
  email: string,
  profile: { plan?: string } | null,
): Promise<string> {
  const row = await getAssinaturaRow(email);
  if (row?.asaas_customer_id) return row.asaas_customer_id;

  const created = await asaasRequest<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: profile?.plan ? `MedSupAPP — ${email}` : `MedSupAPP — ${email}`,
      email,
      externalReference: email,
    }),
  });

  await supabaseAdmin
    .from('assinaturas')
    .update({
      asaas_customer_id: created.id,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', email);

  return created.id;
}

async function ensureAsaasSubscription(
  email: string,
  plano: string,
  trialEndsAt: string | null,
): Promise<string> {
  const row = await getAssinaturaRow(email);
  if (row?.asaas_subscription_id) {
    await syncAsaasSubscriptionPlan(email, plano);
    return row.asaas_subscription_id;
  }

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('plan')
    .eq('email', email)
    .maybeSingle();

  const customerId = await ensureAsaasCustomer(email, profile);
  const nextDueDate = trialEndsAt
    ? trialEndsAt.slice(0, 10)
    : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const valor = await resolveAndPersistBillingValue(email, plano, row, { forceNewLock: true });

  const subscription = await asaasRequest<{ id: string }>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: 'UNDEFINED',
      value: valor,
      cycle: 'MONTHLY',
      nextDueDate,
      description: `MedSupAPP — ${PLANOS[plano as keyof typeof PLANOS]?.nome ?? plano}`,
      externalReference: email,
    }),
  });

  await supabaseAdmin
    .from('assinaturas')
    .update({
      asaas_customer_id: customerId,
      asaas_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', email);

  return subscription.id;
}

export type PagamentoLinkResult = {
  ok: boolean;
  url?: string;
  message: string;
  paymentId?: string;
  paymentStatus?: string;
};

/**
 * Retorna URL de fatura/cobrança Asaas para o dono pagar (PIX, cartão ou boleto no Asaas).
 */
export async function getPagamentoLinkForOwner(ownerEmail: string): Promise<PagamentoLinkResult> {
  const email = ownerEmail.toLowerCase().trim();
  await ensureAssinaturaRecord(email);
  await loadPlanCatalog();
  const row = await getAssinaturaRow(email);
  if (!row) {
    return { ok: false, message: 'Conta de assinatura não encontrada.' };
  }

  const subscriptionId = await ensureAsaasSubscription(
    email,
    row.plano,
    row.trial_ends_at,
  );

  const payments = await listSubscriptionPayments(subscriptionId);
  const open = payments.filter((p) => PENDING_STATUSES.has(p.status ?? ''));
  const target = open.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0];

  if (target) {
    const url = pickPaymentUrl(target);
    if (url) {
      return {
        ok: true,
        url,
        paymentId: target.id,
        paymentStatus: target.status,
        message: 'Abra o link para escolher a forma de pagamento no Asaas.',
      };
    }
  }

  const last = payments[payments.length - 1];
  if (last?.status === 'RECEIVED' || last?.status === 'CONFIRMED') {
    return {
      ok: false,
      message:
        'Não há cobrança em aberto. Se o acesso ainda estiver bloqueado, aguarde alguns minutos após o pagamento ou entre em contato com o suporte.',
    };
  }

  return {
    ok: false,
    message:
      'A cobrança ainda não foi gerada pelo Asaas. Ela aparece perto da data de vencimento da assinatura. Tente novamente em algumas horas ou no dia do vencimento.',
  };
}
