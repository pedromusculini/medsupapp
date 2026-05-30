import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { processScheduledWhatsAppReminders } from '@/lib/whatsappLembretesAgendados';

export const runtime = 'nodejs';

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Cron: lembretes D-7 e D-1 + processa fila pendente */
export async function GET(req: NextRequest) {
  const cronOk = isCronAuthorized(req);
  if (!cronOk) {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
  }

  const result = await processScheduledWhatsAppReminders();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
