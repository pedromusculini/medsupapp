import { NextRequest, NextResponse } from 'next/server';
import { getMedicoByProntuarioToken } from '@/lib/medicoProntuario';

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 400 });
  }

  try {
    const info = await getMedicoByProntuarioToken(token.trim());
    if (!info) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      nomeMedico: info.nomeMedico,
      nomeClinica: info.nomeClinica,
      specialty: info.specialty,
      crm: info.crm,
    });
  } catch (err) {
    console.error('[prontuario/GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar portal' }, { status: 500 });
  }
}
