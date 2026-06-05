import { NextRequest, NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { listPlanCatalogRows, updatePlanCatalogValor } from '@/lib/planCatalog';
import { isValidPlanId, type PlanId } from '@/lib/subscriptionPlans';

export async function GET() {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  try {
    const plans = await listPlanCatalogRows();
    await logInternalAudit({
      adminEmail,
      action: 'view_plan_catalog',
      productId,
    });
    return NextResponse.json({ plans, product_id: productId });
  } catch (error) {
    console.error('[internal/plans/GET]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  try {
    const body = await req.json();
    const planId = String(body.plan_id ?? '').trim();
    const valor = Number(body.valor);

    if (!isValidPlanId(planId)) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    const previous = (await listPlanCatalogRows()).find((p) => p.plan_id === planId);
    const updated = await updatePlanCatalogValor(planId as PlanId, valor, adminEmail);

    await logInternalAudit({
      adminEmail,
      action: 'update_plan_catalog',
      productId,
      metadata: {
        plan_id: planId,
        valor_anterior: previous?.valor ?? null,
        valor_novo: updated.valor,
      },
    });

    return NextResponse.json({
      ok: true,
      plan: { plan_id: planId, ...updated },
      message:
        'Preço de catálogo atualizado. Novos clientes e renovações após o contrato de 12 meses usarão este valor. Clientes com preço travado não são alterados.',
    });
  } catch (error) {
    console.error('[internal/plans/PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao salvar';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
