import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import { findCliente, loadClientesStore } from '@/lib/clientesDrive';
import {
  loadProntuarioEntradas,
  loadProntuarioSeries,
  rebuildSeriesFromEntradas,
  saveProntuarioEntradas,
  saveProntuarioSeries,
  sortEntradas,
  type ProntuarioEntrada,
} from '@/lib/prontuarioEntradasDrive';
import { loadMergedProntuarioEntradasForCliente } from '@/lib/prontuarioEntradasMerge';
import { buildProntuarioAccessStatus } from '@/lib/prontuarioAcesso';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId } = await params;

  const access = await buildProntuarioAccessStatus(email, req);
  if (access.locked) {
    return NextResponse.json(
      { error: 'Prontuário protegido', code: 'PRONTUARIO_LOCKED' },
      { status: 403 },
    );
  }

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  if (!findCliente(store, clienteId)) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const [entradas, series, driveStore] = await Promise.all([
    loadMergedProntuarioEntradasForCliente({
      clinicaEmail: email,
      clienteDriveId: clienteId,
      accessToken: tokenResult,
    }),
    loadProntuarioSeries(tokenResult, clienteId),
    loadProntuarioEntradas(tokenResult, clienteId),
  ]);

  let seriesPayload = series?.series ?? {};
  const seriesPointCount = Object.values(seriesPayload).reduce((n, arr) => n + arr.length, 0);
  const driveHasMeasures = driveStore.entradas.some(
    (e) => e.campos && Object.keys(e.campos).length > 0,
  );

  if (seriesPointCount === 0 && driveHasMeasures) {
    const rebuilt = rebuildSeriesFromEntradas(driveStore);
    seriesPayload = rebuilt.series;
    void saveProntuarioSeries(tokenResult, clienteId, rebuilt).catch((err) => {
      console.warn('[prontuario/entradas] rebuild series.json:', err);
    });
  }

  return NextResponse.json({
    entradas,
    series: seriesPayload,
    atualizado_em: series?.atualizado_em ?? driveStore.atualizado_em,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;
  const { id: clienteId } = await params;

  const access = await buildProntuarioAccessStatus(email, req);
  if (access.modoRecepcao) {
    return NextResponse.json(
      { error: 'Indisponível no modo recepção.' },
      { status: 403 },
    );
  }
  if (access.locked) {
    return NextResponse.json(
      { error: 'Desbloqueie o prontuário com o PIN.', code: 'PRONTUARIO_LOCKED' },
      { status: 403 },
    );
  }

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const store = await loadClientesStore(tokenResult, email);
  const cliente = findCliente(store, clienteId);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const body = await req.json();
  const texto = String(body.texto ?? '').trim();
  if (!texto || texto.length < 2) {
    return NextResponse.json({ error: 'Texto da evolução é obrigatório' }, { status: 400 });
  }

  const hoje = new Date();
  const data =
    body.data ? String(body.data) : hoje.toISOString().slice(0, 10);
  const hora = body.hora ? String(body.hora).slice(0, 5) : null;
  const medico = body.medico ? String(body.medico).trim() : null;

  const entrada: ProntuarioEntrada = {
    id: crypto.randomUUID(),
    data,
    hora,
    medico,
    texto,
    tipo: body.tipo ? String(body.tipo) : 'evolucao',
    campos: {},
    origem: 'manual',
  };

  const prontStore = await loadProntuarioEntradas(tokenResult, clienteId);
  prontStore.entradas.push(entrada);
  prontStore.entradas = sortEntradas(prontStore.entradas);
  await saveProntuarioEntradas(tokenResult, clienteId, prontStore);

  return NextResponse.json({ ok: true, entrada }, { status: 201 });
}
