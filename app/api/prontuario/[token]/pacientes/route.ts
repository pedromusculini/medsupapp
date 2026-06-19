import { NextRequest, NextResponse } from 'next/server';
import { guardLegacyProntuarioApi } from '@/lib/prontuarioApiGuard';
import {
  getMedicoByProntuarioToken,
  searchPacientesClinica,
} from '@/lib/medicoProntuario';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const blocked = await guardLegacyProntuarioApi(req, token);
  if (blocked) return blocked;

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';

  if (!token?.trim()) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ pacientes: [] });
  }

  try {
    const info = await getMedicoByProntuarioToken(token.trim());
    if (!info) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
    }

    const pacientes = await searchPacientesClinica(info.clinicaEmail, q);
    return NextResponse.json({ pacientes });
  } catch (err) {
    console.error('[prontuario/pacientes]', err);
    return NextResponse.json({ error: 'Erro na busca' }, { status: 500 });
  }
}
