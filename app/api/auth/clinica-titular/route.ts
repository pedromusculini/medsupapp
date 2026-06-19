import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isClinicaTitular } from '@/lib/clinicaTitular';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const titular = await isClinicaTitular(session);
  return NextResponse.json({ titular });
}
