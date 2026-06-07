import { NextRequest, NextResponse } from 'next/server';
import {
  getMedicoByProntuarioToken,
  getPacienteHistoricoClinico,
} from '@/lib/medicoProntuario';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const sp = new URL(req.url).searchParams;

  if (!token?.trim()) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 400 });
  }

  const clienteDriveId = sp.get('cliente_drive_id')?.trim() || null;
  const pacienteNome = sp.get('paciente_nome')?.trim() || null;
  const telefone = sp.get('telefone')?.trim() || null;

  if (!clienteDriveId && !pacienteNome && !telefone) {
    return NextResponse.json({ error: 'Paciente não informado' }, { status: 400 });
  }

  try {
    const info = await getMedicoByProntuarioToken(token.trim());
    if (!info) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
    }

    const historico = await getPacienteHistoricoClinico({
      clinicaEmail: info.clinicaEmail,
      clienteDriveId,
      pacienteNome,
      telefone,
      limit: 5,
    });

    return NextResponse.json(historico);
  } catch (err) {
    console.error('[prontuario/historico]', err);
    return NextResponse.json({ error: 'Erro ao carregar histórico' }, { status: 500 });
  }
}
