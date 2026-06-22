import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { loadPublicPortfolio } from '@/lib/portfolio';

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get('owner')?.trim();
  const medico = req.nextUrl.searchParams.get('medico')?.trim();

  if (!owner || !medico) {
    return NextResponse.json({ error: 'owner e medico são obrigatórios' }, { status: 400 });
  }

  const rl = await checkRateLimit(`portfolio-public:${owner}:${medico}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas' }, { status: 429 });
  }

  try {
    const data = await loadPublicPortfolio(owner, medico);
    if (!data) {
      return NextResponse.json({ error: 'Portfólio não encontrado' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[public/portfolio]', error);
    return NextResponse.json({ error: 'Erro ao carregar portfólio' }, { status: 500 });
  }
}
