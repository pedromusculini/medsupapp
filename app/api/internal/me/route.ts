import { NextResponse } from 'next/server';
import { requireInternalAdmin, isInternalAdminError } from '@/lib/internalAdmin';

/** Indica se a sessão atual é admin interno (para link no Header). */
export async function GET() {
  const authResult = await requireInternalAdmin();
  if (isInternalAdminError(authResult)) {
    return NextResponse.json({ admin: false }, { status: 404 });
  }
  return NextResponse.json({
    admin: true,
    email: authResult.email,
    product_id: authResult.productId,
  });
}
