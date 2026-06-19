import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  doctorsCountFromPlan,
  isValidPlanId,
  planToUserType,
  resolveProfilePlanId,
  type PlanId,
} from '@/lib/subscriptionPlans';

type ProfilePlanRow = {
  plan?: string | null;
  user_type?: string | null;
  doctors_count?: number | null;
};

/** Corrige `onboarding_profiles.plan` e `assinaturas.plano` quando o valor é legado. */
export async function repairProfilePlanIfNeeded(
  email: string,
  profile: ProfilePlanRow,
): Promise<{ planId: PlanId; repaired: boolean }> {
  const normalized = resolveProfilePlanId(profile);
  const raw = (profile.plan ?? '').trim();

  if (raw === normalized && isValidPlanId(raw)) {
    return { planId: normalized, repaired: false };
  }

  const userType = planToUserType(normalized);
  const doctorsCount =
    userType === 'clinica' ? doctorsCountFromPlan(normalized) : null;

  const { error: profileError } = await supabaseAdmin
    .from('onboarding_profiles')
    .update({
      plan: normalized,
      user_type: userType,
      doctors_count: doctorsCount,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email);

  if (profileError) {
    console.error('[repairProfilePlan] onboarding_profiles:', profileError);
    return { planId: normalized, repaired: false };
  }

  const { error: assinaturaError } = await supabaseAdmin
    .from('assinaturas')
    .update({
      plano: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_email', email);

  if (assinaturaError && assinaturaError.code !== 'PGRST116') {
    console.error('[repairProfilePlan] assinaturas:', assinaturaError);
  }

  return { planId: normalized, repaired: true };
}
