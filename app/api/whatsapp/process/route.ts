import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { processPendingWhatsAppQueue } from '@/lib/whatsappQueueProcessor';
import { isWhatsAppCloudConfigured } from '@/lib/whatsappConfig';

export const runtime = 'nodejs';

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

/** Processa fila pendente — Vercel Cron ou usuário autenticado */
export async function GET(req: NextRequest) {
  const cronOk = isCronAuthorized(req);
  if (!cronOk) {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
  }

  if (!isWhatsAppCloudConfigured()) {
    return NextResponse.json({
      skipped: true,
      message:
        'WhatsApp Cloud API não configurada. Veja docs/WHATSAPP_BUSINESS_SETUP.md',
    });
  }

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get('limit') || 25),
    50,
  );
  const result = await processPendingWhatsAppQueue(limit);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
