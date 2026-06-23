import {
  findCliente,
  findClienteByContato,
  loadClientesStore,
  type ClienteDriveRecord,
} from '@/lib/clientesDrive';
import type { ClienteObservacao } from '@/lib/types';
import { getOwnerDriveAccessToken } from '@/lib/ownerGoogleDrive';
import { isProntuarioObservacao, stripProntuarioPrefix } from '@/lib/prontuarioContent';
import {
  entradaHash,
  loadProntuarioEntradas,
  sortEntradas,
  type ProntuarioEntrada,
  type ProntuarioEntradaOrigem,
} from '@/lib/prontuarioEntradasDrive';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { normalizePhoneDigits, normalizePhoneForStorage } from '@/lib/phone';

export type ProntuarioEntradaUnified = {
  id: string;
  texto: string;
  autor_nome: string | null;
  paciente_nome?: string;
  created_at: string;
  cliente_drive_id?: string | null;
  origem?: ProntuarioEntradaOrigem;
};

function driveEntradaCreatedAt(e: ProntuarioEntrada): string {
  const hora = e.hora?.slice(0, 5) ?? '12:00';
  return `${e.data}T${hora}:00`;
}

function contentHash(
  texto: string,
  createdAt: string,
  autor: string | null,
): string {
  const d = new Date(createdAt);
  const data = Number.isNaN(d.getTime())
    ? createdAt.slice(0, 10)
    : d.toISOString().slice(0, 10);
  const hora = Number.isNaN(d.getTime())
    ? null
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return entradaHash({
    data,
    hora,
    medico: autor,
    texto: stripProntuarioPrefix(texto),
  });
}

export function legadoObservacaoToUnified(
  obs: ClienteObservacao,
  clienteId: string,
): ProntuarioEntradaUnified {
  return {
    id: `legado-obs:${obs.id}`,
    texto: stripProntuarioPrefix(obs.texto),
    autor_nome: obs.autor,
    created_at: obs.created_at,
    cliente_drive_id: clienteId,
    origem: 'legado_observacao',
  };
}

export function driveEntradaToUnified(
  entrada: ProntuarioEntrada,
  clienteId: string,
  pacienteNome?: string,
): ProntuarioEntradaUnified {
  return {
    id: entrada.id,
    texto: entrada.texto,
    autor_nome: entrada.medico,
    paciente_nome: pacienteNome,
    created_at: driveEntradaCreatedAt(entrada),
    cliente_drive_id: clienteId,
    origem: entrada.origem,
  };
}

export function dedupeUnifiedEntradas(
  items: ProntuarioEntradaUnified[],
): ProntuarioEntradaUnified[] {
  const seen = new Set<string>();
  const out: ProntuarioEntradaUnified[] = [];

  const sorted = [...items].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  for (const item of sorted) {
    const hash = contentHash(item.texto, item.created_at, item.autor_nome);
    if (seen.has(hash)) continue;
    seen.add(hash);
    out.push(item);
  }

  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function mergeProntuarioEntradasFromSources(params: {
  clienteId: string;
  pacienteNome?: string;
  driveEntradas: ProntuarioEntrada[];
  legadoObservacoes?: ClienteObservacao[];
  supabaseEntradas?: Array<{
    id: string;
    texto: string;
    autor_nome: string;
    paciente_nome?: string;
    created_at: string;
    cliente_drive_id?: string | null;
  }>;
}): ProntuarioEntradaUnified[] {
  const pacienteNome = params.pacienteNome;
  const items: ProntuarioEntradaUnified[] = [
    ...params.driveEntradas.map((e) =>
      driveEntradaToUnified(e, params.clienteId, pacienteNome),
    ),
    ...(params.legadoObservacoes ?? [])
      .filter((o) => isProntuarioObservacao(o.texto))
      .map((o) => legadoObservacaoToUnified(o, params.clienteId)),
    ...(params.supabaseEntradas ?? []).map((e) => ({
      id: e.id,
      texto: e.texto,
      autor_nome: e.autor_nome,
      paciente_nome: e.paciente_nome,
      created_at: e.created_at,
      cliente_drive_id: e.cliente_drive_id ?? params.clienteId,
      origem: 'medico_portal' as const,
    })),
  ];

  return dedupeUnifiedEntradas(items);
}

export function legadoObservacaoToDriveEntrada(
  obs: ClienteObservacao,
): ProntuarioEntrada {
  const created = new Date(obs.created_at);
  const data = Number.isNaN(created.getTime())
    ? obs.created_at.slice(0, 10)
    : created.toISOString().slice(0, 10);
  const hora = Number.isNaN(created.getTime())
    ? null
    : `${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}`;
  const texto = stripProntuarioPrefix(obs.texto);

  return {
    id: `legado-obs:${obs.id}`,
    data,
    hora,
    medico: obs.autor,
    texto,
    tipo: 'evolucao',
    campos: {},
    origem: 'legado_observacao',
    hash_linha: entradaHash({ data, hora, medico: obs.autor, texto }),
  };
}

async function resolveCliente(
  accessToken: string,
  ownerEmail: string,
  params: {
    clienteDriveId?: string | null;
    pacienteNome?: string | null;
    telefone?: string | null;
  },
): Promise<ClienteDriveRecord | null> {
  const store = await loadClientesStore(accessToken, ownerEmail);
  const telefoneNorm = params.telefone
    ? normalizePhoneForStorage(params.telefone)
    : null;
  const nome = params.pacienteNome?.trim() ?? '';

  let cliente = params.clienteDriveId
    ? findCliente(store, params.clienteDriveId)
    : undefined;

  if (!cliente && telefoneNorm) {
    cliente = findClienteByContato(store, { telefone: telefoneNorm });
  }

  if (!cliente && nome) {
    cliente = store.clientes.find(
      (c) => c.nome.toLowerCase().trim() === nome.toLowerCase().trim(),
    );
  }

  return cliente ?? null;
}

async function loadSupabaseEntradas(params: {
  clinicaEmail: string;
  clienteDriveId?: string | null;
  pacienteNome?: string | null;
  telefone?: string | null;
  medicoId?: string | null;
  limit?: number;
}) {
  const owner = params.clinicaEmail.toLowerCase().trim();
  let q = supabaseAdmin
    .from('prontuario_entradas')
    .select(
      'id, texto, autor_nome, paciente_nome, created_at, cliente_drive_id, sync_drive_at',
    )
    .eq('clinica_email', owner)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50);

  if (params.clienteDriveId) {
    q = q.eq('cliente_drive_id', params.clienteDriveId);
  } else if (params.telefone) {
    q = q.eq('telefone', normalizePhoneDigits(params.telefone));
  } else if (params.pacienteNome?.trim()) {
    q = q.ilike('paciente_nome', params.pacienteNome.trim());
  }
  if (params.medicoId) {
    q = q.eq('clinica_medicos_id', params.medicoId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function loadMergedProntuarioEntradas(params: {
  clinicaEmail: string;
  clienteDriveId?: string | null;
  pacienteNome?: string | null;
  telefone?: string | null;
  medicoId?: string | null;
  limit?: number;
}): Promise<ProntuarioEntradaUnified[]> {
  const owner = params.clinicaEmail.toLowerCase().trim();
  const limit = params.limit ?? 50;
  const accessToken = await getOwnerDriveAccessToken(owner);

  const supabaseRows = await loadSupabaseEntradas(params);
  const pendentes = supabaseRows.filter((r) => !r.sync_drive_at);

  if (!accessToken) {
    return dedupeUnifiedEntradas(
      pendentes.map((e) => ({
        id: e.id,
        texto: e.texto,
        autor_nome: e.autor_nome,
        paciente_nome: e.paciente_nome,
        created_at: e.created_at,
        cliente_drive_id: e.cliente_drive_id,
      })),
    ).slice(0, limit);
  }

  const cliente = await resolveCliente(accessToken, owner, params);
  if (!cliente) {
    return dedupeUnifiedEntradas(
      pendentes.map((e) => ({
        id: e.id,
        texto: e.texto,
        autor_nome: e.autor_nome,
        paciente_nome: e.paciente_nome,
        created_at: e.created_at,
        cliente_drive_id: e.cliente_drive_id,
      })),
    ).slice(0, limit);
  }

  const driveStore = await loadProntuarioEntradas(accessToken, cliente.id);
  const merged = mergeProntuarioEntradasFromSources({
    clienteId: cliente.id,
    pacienteNome: cliente.nome,
    driveEntradas: driveStore.entradas,
    legadoObservacoes: cliente.observacoes,
    supabaseEntradas: pendentes,
  });

  return merged.slice(0, limit);
}

export function unifiedToDriveEntrada(item: ProntuarioEntradaUnified): ProntuarioEntrada {
  const d = new Date(item.created_at);
  const data = Number.isNaN(d.getTime())
    ? item.created_at.slice(0, 10)
    : d.toISOString().slice(0, 10);
  const hora = Number.isNaN(d.getTime())
    ? null
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return {
    id: item.id,
    data,
    hora,
    medico: item.autor_nome,
    texto: item.texto,
    tipo: 'evolucao',
    campos: {},
    origem:
      item.origem ??
      (item.id.startsWith('legado-obs:') ? 'legado_observacao' : 'manual'),
    hash_linha: entradaHash({
      data,
      hora,
      medico: item.autor_nome,
      texto: item.texto,
    }),
  };
}

function supabaseRowToDriveEntrada(
  row: {
    id: string;
    texto: string;
    autor_nome: string;
    created_at: string;
  },
  clienteId: string,
): ProntuarioEntrada {
  const created = new Date(row.created_at);
  const data = Number.isNaN(created.getTime())
    ? row.created_at.slice(0, 10)
    : created.toISOString().slice(0, 10);
  const hora = Number.isNaN(created.getTime())
    ? null
    : `${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}`;
  const texto = stripProntuarioPrefix(row.texto);

  return {
    id: row.id,
    data,
    hora,
    medico: row.autor_nome,
    texto,
    tipo: 'evolucao',
    campos: {},
    origem: 'medico_portal',
    hash_linha: entradaHash({ data, hora, medico: row.autor_nome, texto }),
  };
}

/** Evoluções do paciente (Drive + legado + fila Supabase), preservando medidas do CSV. */
export async function loadMergedProntuarioEntradasForCliente(params: {
  clinicaEmail: string;
  clienteDriveId: string;
  /** Token da sessão/cookie — preferir ao lookup só no Supabase. */
  accessToken?: string | null;
  limit?: number;
}): Promise<ProntuarioEntrada[]> {
  const owner = params.clinicaEmail.toLowerCase().trim();
  const limit = params.limit ?? 500;
  const accessToken =
    params.accessToken ?? (await getOwnerDriveAccessToken(owner));

  const supabaseRows = await loadSupabaseEntradas({
    clinicaEmail: owner,
    clienteDriveId: params.clienteDriveId,
    limit,
  });
  const pendentes = supabaseRows.filter((r) => !r.sync_drive_at);

  if (!accessToken) {
    return sortEntradas(pendentes.map((r) => supabaseRowToDriveEntrada(r, params.clienteDriveId))).slice(
      0,
      limit,
    );
  }

  const store = await loadClientesStore(accessToken, owner);
  const cliente = findCliente(store, params.clienteDriveId);
  if (!cliente) {
    return sortEntradas(pendentes.map((r) => supabaseRowToDriveEntrada(r, params.clienteDriveId))).slice(
      0,
      limit,
    );
  }

  const driveStore = await loadProntuarioEntradas(accessToken, params.clienteDriveId);
  const result: ProntuarioEntrada[] = [...driveStore.entradas];
  const seenHashes = new Set(
    result.map((e) => e.hash_linha).filter((h): h is string => Boolean(h)),
  );

  for (const obs of (cliente.observacoes ?? []).filter((o) => isProntuarioObservacao(o.texto))) {
    const legado = legadoObservacaoToDriveEntrada(obs);
    if (legado.hash_linha && seenHashes.has(legado.hash_linha)) continue;
    result.push(legado);
    if (legado.hash_linha) seenHashes.add(legado.hash_linha);
  }

  for (const row of pendentes) {
    const sup = supabaseRowToDriveEntrada(row, params.clienteDriveId);
    if (sup.hash_linha && seenHashes.has(sup.hash_linha)) continue;
    result.push(sup);
    if (sup.hash_linha) seenHashes.add(sup.hash_linha);
  }

  return sortEntradas(result).slice(0, limit);
}
