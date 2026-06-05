import { NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import { getAssinaturaRow, getSubscriptionAccess } from '@/lib/assinatura';
import { hasCompletedOnboarding } from '@/lib/onboardingGate';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getPlanCatalogSync, loadPlanCatalog } from '@/lib/planCatalog';
import { getEffectiveBillingValue } from '@/lib/priceLock';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const onboardingDone = await hasCompletedOnboarding(email);
    if (!onboardingDone) {
      return NextResponse.json(
        {
          error:
            'Complete seu cadastro em /onboarding antes de acessar Minha conta.',
          code: 'ONBOARDING_REQUIRED',
        },
        { status: 403 },
      );
    }

    await loadPlanCatalog();
    const subscription = await getSubscriptionAccess(email);
    const assinaturaRow = await getAssinaturaRow(email);

    const { data: profile } = await supabaseAdmin
      .from('onboarding_profiles')
      .select('plan, user_type, trial_started')
      .eq('email', email)
      .maybeSingle();

    const planId = profile?.plan || subscription.plano;
    const catalog = getPlanCatalogSync();
    const planInfo =
      planId && planId in catalog
        ? catalog[planId as keyof typeof catalog]
        : null;

    return NextResponse.json({
      subscription,
      profile: {
        plan: profile?.plan ?? subscription.plano,
        user_type: profile?.user_type,
        trial_started: profile?.trial_started,
        plan_name: planInfo?.nome ?? profile?.plan,
        plan_value: getEffectiveBillingValue(planId || 'medico-pix', assinaturaRow),
        price_locked_until: assinaturaRow?.price_locked_until ?? null,
        price_lock_active: subscription.price_lock_active,
      },
    });
  } catch (error) {
    console.error('[conta/GET]', error);
    return NextResponse.json({ error: 'Erro ao carregar conta' }, { status: 500 });
  }
}
