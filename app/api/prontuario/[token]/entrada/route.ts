import { NextRequest, NextResponse } from 'next/server';
import { guardLegacyProntuarioApi } from '@/lib/prontuarioApiGuard';
import {
  addProntuarioEntrada,
  getMedicoByProntuarioToken,
  listProntuarioEntradas,
} from '@/lib/medicoProntuario';
import { normalizePhoneForStorage, isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/phone';
import { syncProntuarioEntradaById } from '@/lib/syncProntuarioDrive';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const blocked = await guardLegacyProntuarioApi(req, token);
  if (blocked) return blocked;

  const sp = new URL(req.url).searchParams;
  const clienteDriveId = sp.get('cliente_drive_id');
  const pacienteNome = sp.get('paciente_nome');
  const telefone = sp.get('telefone');

  if (!token?.trim()) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 400 });
  }

  try {
    const info = await getMedicoByProntuarioToken(token.trim());
    if (!info) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
    }

    const entradas = await listProntuarioEntradas({
      clinicaEmail: info.clinicaEmail,
      clienteDriveId: clienteDriveId ?? undefined,
      pacienteNome: pacienteNome ?? undefined,
      telefone: telefone ?? undefined,
      medicoId: info.medicoId,
      limit: 30,
    });

    return NextResponse.json({ entradas });
  } catch (err) {
    console.error('[prontuario/entrada GET]', err);
    return NextResponse.json({ error: 'Erro ao carregar prontuário' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const blocked = await guardLegacyProntuarioApi(req, token);
  if (blocked) return blocked;

  if (!token?.trim()) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 400 });
  }

  try {
    const info = await getMedicoByProntuarioToken(token.trim());
    if (!info) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
    }

    const body = await req.json();
    const texto = String(body.texto ?? '').trim();
    const pacienteNome = String(body.paciente_nome ?? body.paciente ?? '').trim();

    if (!texto || texto.length < 3) {
      return NextResponse.json({ error: 'Texto do prontuário é obrigatório' }, { status: 400 });
    }
    if (!pacienteNome) {
      return NextResponse.json({ error: 'Paciente é obrigatório' }, { status: 400 });
    }

    const telefone = body.telefone
      ? normalizePhoneForStorage(String(body.telefone))
      : null;
    if (body.telefone && !telefone) {
      return NextResponse.json({ error: PHONE_VALIDATION_MESSAGE }, { status: 400 });
    }

    const entrada = await addProntuarioEntrada({
      clinicaEmail: info.clinicaEmail,
      medicoId: info.medicoId,
      autorNome: info.nomeMedico,
      pacienteNome,
      telefone,
      clienteDriveId: body.cliente_drive_id ? String(body.cliente_drive_id) : null,
      texto,
    });

    const driveSync = await syncProntuarioEntradaById(entrada.id);

    return NextResponse.json(
      {
        ok: true,
        entrada,
        drive_synced: driveSync.synced,
        cliente_drive_id: driveSync.clienteDriveId ?? null,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[prontuario/entrada POST]', err);
    return NextResponse.json({ error: 'Erro ao salvar prontuário' }, { status: 500 });
  }
}
