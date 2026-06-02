import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isInternalAdminEmail } from '@/lib/internalAdmin';
import { getInternalProductId } from '@/lib/internalProduct';

/** Indica se a sessão atual é admin interno (para link no Header). */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email || !isInternalAdminEmail(email)) {
    return NextResponse.json({ admin: false });
  }
  return NextResponse.json({
    admin: true,
    email,
    product_id: getInternalProductId(),
  });
}
