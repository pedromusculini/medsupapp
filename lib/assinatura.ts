import { supabaseAdmin } from '@/lib/supabaseClient';

export type AssinaturaStatus = 'trial' | 'active' | 'expired';

export type SubscriptionAccess = {
  status: AssinaturaStatus;
  canUseApp: boolean;
  plano: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  daysLeftTrial: number | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
};

const TRIAL_DAYS = 30;

function addDaysIso(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function addMonthsFromDateString(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString();
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}

export function evaluateAccess(row: {
  status: AssinaturaStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
}): { status: AssinaturaStatus; canUseApp: boolean } {
  const now = Date.now();

  if (row.status === 'trial') {
    const end = row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : 0;
    if (end > now) return { status: 'trial', canUseApp: true };
    return { status: 'expired', canUseApp: false };
  }

  if (row.status === 'active') {
    const end = row.current_period_end ? new Date(row.current_period_end).getTime() : 0;
    if (end > now) return { status: 'active', canUseApp: true };
    return { status: 'expired', canUseApp: false };
  }

  return { status: 'expired', canUseApp: false };
}

export async function ensureAssinaturaRecord(ownerEmail: string): Promise<SubscriptionAccess> {
  const email = ownerEmail.toLowerCase().trim();

  const { data: existing } = await supabaseAdmin
    .from('assinaturas')
    .select('*')
    .eq('owner_email', email)
    .maybeSingle();

  if (existing) {
    return rowToAccess(existing);
  }

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('plan, trial_started')
    .eq('email', email)
    .maybeSingle();

  const { data: access } = await supabaseAdmin
    .from('google_account_access')
    .select('trial_started_at')
    .eq('email', email)
    .maybeSingle();

  const trialStart = access?.trial_started_at
    ? new Date(access.trial_started_at)
    : new Date();
  const trialEnds = addDaysIso(trialStart, TRIAL_DAYS);
  const plano = profile?.plan || 'medico-pix';
  const status: AssinaturaStatus =
    profile?.trial_started === true ? 'trial' : 'expired';

  const { data: inserted, error } = await supabaseAdmin
    .from('assinaturas')
    .insert({
      owner_email: email,
      status,
      plano,
      trial_ends_at: status === 'trial' ? trialEnds : null,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToAccess(inserted);
}

function rowToAccess(row: {
  status: string;
  plano: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  asaas_customer_id?: string | null;
  asaas_subscription_id?: string | null;
}): SubscriptionAccess {
  const evaluated = evaluateAccess({
    status: row.status as AssinaturaStatus,
    trial_ends_at: row.trial_ends_at,
    current_period_end: row.current_period_end,
  });

  return {
    status: evaluated.status,
    canUseApp: evaluated.canUseApp,
    plano: row.plano,
    trial_ends_at: row.trial_ends_at,
    current_period_end: row.current_period_end,
    daysLeftTrial:
      evaluated.status === 'trial' ? daysUntil(row.trial_ends_at) : null,
    asaas_customer_id: row.asaas_customer_id ?? null,
    asaas_subscription_id: row.asaas_subscription_id ?? null,
  };
}

export async function getSubscriptionAccess(
  ownerEmail: string,
): Promise<SubscriptionAccess> {
  const email = ownerEmail.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('assinaturas')
    .select('*')
    .eq('owner_email', email)
    .maybeSingle();

  if (error) throw error;
  if (!data) return ensureAssinaturaRecord(email);

  const access = rowToAccess(data);
  if (!access.canUseApp && data.status !== 'expired') {
    await supabaseAdmin
      .from('assinaturas')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('owner_email', email);
    return { ...access, status: 'expired', canUseApp: false };
  }
  return access;
}

export async function activateFromPayment(params: {
  ownerEmail: string;
  paymentId: string;
  dueDate?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<void> {
  const email = params.ownerEmail.toLowerCase().trim();
  await ensureAssinaturaRecord(email);

  const periodEnd = params.dueDate
    ? addMonthsFromDateString(params.dueDate.slice(0, 10), 1)
    : addDaysIso(new Date(), 30);

  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'active',
      last_payment_at: new Date().toISOString(),
      current_period_end: periodEnd,
      last_asaas_payment_id: params.paymentId,
      asaas_customer_id: params.customerId ?? undefined,
      asaas_subscription_id: params.subscriptionId ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', email);

  if (error) throw error;
}

export async function expireAssinatura(ownerEmail: string): Promise<void> {
  const email = ownerEmail.toLowerCase().trim();
  await ensureAssinaturaRecord(email);

  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', email);

  if (error) throw error;
}
