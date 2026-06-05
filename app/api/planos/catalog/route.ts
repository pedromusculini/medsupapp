import { NextResponse } from 'next/server';
import { loadPlanCatalog } from '@/lib/planCatalog';
import { PLAN_IDS, planToUserType, maxMedicosCadastrados } from '@/lib/subscriptionPlans';

export async function GET() {
  try {
    const catalog = await loadPlanCatalog();
    const planos = PLAN_IDS.map((id) => ({
      id,
      ...catalog[id],
      user_type: planToUserType(id),
      max_medicos: maxMedicosCadastrados(id),
    }));
    return NextResponse.json({ planos });
  } catch (error) {
    console.error('[planos/catalog]', error);
    return NextResponse.json({ error: 'Erro ao carregar planos' }, { status: 500 });
  }
}
