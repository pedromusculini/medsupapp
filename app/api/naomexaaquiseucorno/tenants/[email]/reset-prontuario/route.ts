import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';
import { logInternalAudit } from '@/lib/internalAudit';
import { resetProntuarioSeguranca } from '@/lib/prontuarioAcesso';

type RouteContext = { params: Promise<{ email: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) return authResult;
  const { email: adminEmail, productId } = authResult;

  const { email: raw } = await context.params;
  const ownerEmail = decodeURIComponent(raw).toLowerCase().trim();

  try {
    const result = await resetProntuarioSeguranca(ownerEmail);

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    await logInternalAudit({
      adminEmail,
      action: 'reset_tenant_prontuario',
      productId,
      targetOwnerEmail: ownerEmail,
      metadata: { had_pin: result.hadPin },
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error('[internal/reset-prontuario]', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
