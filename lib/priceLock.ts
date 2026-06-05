import { getPlanValor, loadPlanCatalog } from '@/lib/planCatalog';
import { asaasRequest, isAsaasApiConfigured } from '@/lib/asaasApi';
import { supabaseAdmin } from '@/lib/supabaseClient';

/** Duração do contrato de preço fixo (meses). */
export const PRICE_LOCK_MONTHS = 12;

export type PriceLockFields = {
  locked_monthly_value?: number | null;
  price_locked_until?: string | null;
  price_locked_at?: string | null;
};

export function computePriceLockedUntil(from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + PRICE_LOCK_MONTHS);
  return d.toISOString();
}

export function isPriceLockActive(priceLockedUntil: string | null | undefined): boolean {
  if (!priceLockedUntil) return false;
  return new Date(priceLockedUntil).getTime() > Date.now();
}

export function buildNewPriceLock(valor: number, from = new Date()): PriceLockFields {
  return {
    locked_monthly_value: valor,
    price_locked_until: computePriceLockedUntil(from),
    price_locked_at: from.toISOString(),
  };
}

type RowWithLock = PriceLockFields & {
  asaas_subscription_id?: string | null;
};

async function fetchAsaasSubscriptionValue(subscriptionId: string): Promise<number | null> {
  if (!isAsaasApiConfigured()) return null;
  try {
    const sub = await asaasRequest<{ value?: number }>(`/subscriptions/${subscriptionId}`);
    return sub.value != null ? Number(sub.value) : null;
  } catch {
    return null;
  }
}

/** Valor para exibição/cobrança sem gravar (leitura). */
export function getEffectiveBillingValue(plano: string, row: RowWithLock | null): number {
  if (
    row?.locked_monthly_value != null &&
    isPriceLockActive(row.price_locked_until)
  ) {
    return Number(row.locked_monthly_value);
  }
  return getPlanValor(plano);
}

/**
 * Valor efetivo para Asaas. Grava bloqueio de 12 meses quando:
 * - novo cliente / sem bloqueio;
 * - bloqueio expirou (renova ao preço de catálogo vigente);
 * - troca de plano (forceNewLock).
 */
export async function resolveAndPersistBillingValue(
  ownerEmail: string,
  plano: string,
  row: RowWithLock | null,
  options: { forceNewLock?: boolean } = {},
): Promise<number> {
  const email = ownerEmail.toLowerCase().trim();
  await loadPlanCatalog();
  const catalog = getPlanValor(plano);

  if (
    !options.forceNewLock &&
    row?.locked_monthly_value != null &&
    isPriceLockActive(row.price_locked_until)
  ) {
    return Number(row.locked_monthly_value);
  }

  let valor = catalog;
  if (
    !options.forceNewLock &&
    row?.locked_monthly_value == null &&
    row?.asaas_subscription_id
  ) {
    const asaasVal = await fetchAsaasSubscriptionValue(row.asaas_subscription_id);
    if (asaasVal != null) valor = asaasVal;
  }

  const lock = buildNewPriceLock(valor);
  await supabaseAdmin
    .from('assinaturas')
    .update({
      ...lock,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', email);

  return valor;
}
