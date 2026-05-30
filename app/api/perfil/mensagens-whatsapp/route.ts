import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedOwner, isAuthError } from '@/lib/api-auth';
import {
  DEFAULT_MENSAGENS,
  getMensagensConfig,
  saveMensagensConfig,
  type MensagensWhatsappConfig,
} from '@/lib/mensagensWhatsapp';

export async function GET() {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const config = await getMensagensConfig(email);
    return NextResponse.json({ config, defaults: DEFAULT_MENSAGENS });
  } catch (error) {
    console.error('[mensagens-whatsapp/GET]', error);
    return NextResponse.json({ error: 'Erro ao carregar mensagens' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireVerifiedOwner();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  try {
    const body = await req.json();
    const partial = body.config as Partial<MensagensWhatsappConfig>;
    const config = await saveMensagensConfig(email, partial);
    return NextResponse.json({ config });
  } catch (error) {
    console.error('[mensagens-whatsapp/PUT]', error);
    return NextResponse.json({ error: 'Erro ao salvar mensagens' }, { status: 500 });
  }
}
