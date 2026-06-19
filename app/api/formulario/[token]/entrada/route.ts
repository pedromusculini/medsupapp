import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireClienteFichaAccess } from '@/lib/api-auth';
import { getOwnerDriveAccessToken } from '@/lib/ownerGoogleDrive';
import {
  loadProntuarioEntradas,
  saveProntuarioEntradas,
  sortEntradas,
  type ProntuarioEntrada,
} from '@/lib/prontuarioEntradasDrive';
import { checkRateLimit } from '@/lib/rateLimit';
import { getRequestIp } from '@/lib/requestIp';
import { supabaseAdmin } from '@/lib/supabaseClient';

type Params = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const ip = getRequestIp(req);
  const ipLimit = await checkRateLimit(`ficha-entrada-ip:${ip}`, 30, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde.' }, { status: 429 });
  }

  const authResult = await requireClienteFichaAccess(token);
  if (isAuthError(authResult)) return authResult;

  const { data: linkRow } = await supabaseAdmin
    .from('formulario_links')
    .select('cliente_drive_id, owner_email')
    .eq('token', token)
    .maybeSingle();

  const clienteDriveId = String(linkRow?.cliente_drive_id ?? '').trim();
  const ownerEmail = String(linkRow?.owner_email ?? '').trim().toLowerCase();
  if (!clienteDriveId || !ownerEmail) {
    return NextResponse.json({ error: 'Link sem paciente associado' }, { status: 400 });
  }

  const body = await req.json();
  const texto = String(body.texto ?? '').trim();
  if (!texto || texto.length < 2) {
    return NextResponse.json({ error: 'Texto da evolução é obrigatório' }, { status: 400 });
  }

  const driveToken = await getOwnerDriveAccessToken(ownerEmail);
  if (!driveToken) {
    return NextResponse.json(
      { error: 'Não foi possível acessar o Drive da clínica' },
      { status: 503 },
    );
  }

  const hoje = new Date();
  const medicoNome =
    authResult.role === 'equipe'
      ? authResult.nomeProfissional ?? 'Médico'
      : body.medico
        ? String(body.medico).trim()
        : null;

  const entrada: ProntuarioEntrada = {
    id: crypto.randomUUID(),
    data: hoje.toISOString().slice(0, 10),
    hora: hoje.toTimeString().slice(0, 5),
    medico: medicoNome,
    texto,
    tipo: 'evolucao',
    campos: {},
    origem: 'profissional_ficha',
  };

  const prontStore = await loadProntuarioEntradas(driveToken, clienteDriveId);
  prontStore.entradas.push(entrada);
  prontStore.entradas = sortEntradas(prontStore.entradas);
  await saveProntuarioEntradas(driveToken, clienteDriveId, prontStore);

  return NextResponse.json({ ok: true, entrada }, { status: 201 });
}
