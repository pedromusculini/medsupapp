import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import type { ConsultaStatus, TipoConsulta } from '@/lib/consultations';
import { preferConsultaStatus } from '@/lib/consultations';
import { normalizePhoneDigits } from '@/lib/phone';
import {
  getLembretesSettings,
  type LembretesWhatsappSettings,
} from '@/lib/lembretesSettings';

export type ConsultaAgendaRow = {
  id: string;
  owner_email: string;
  paciente: string;
  servico: string;
  telefone: string | null;
  inicio: string;
  fim: string | null;
  local: string | null;
  google_event_id: string | null;
  medico: string | null;
  convenio: string | null;
  status: ConsultaStatus;
  lembretes_whatsapp: boolean;
  cliente_drive_id?: string | null;
  tipo_consulta?: TipoConsulta | null;
  observacoes?: string | null;
};

export type ConsultaSyncInput = {
  id: string;
  paciente: string;
  servico?: string;
  telefone?: string | null;
  inicio: string;
  fim?: string | null;
  local?: string | null;
  google_event_id?: string | null;
  medico?: string | null;
  convenio?: string | null;
  status?: ConsultaStatus;
  lembretes_whatsapp?: boolean;
  cliente_drive_id?: string | null;
  tipo_consulta?: TipoConsulta | null;
  observacoes?: string | null;
};

const MS_DAY = 24 * 60 * 60 * 1000;
const BR_TIMEZONE = 'America/Sao_Paulo';

export function isLegacyConsultaId(id: string): boolean {
  const s = String(id);
  return s.startsWith('local-') || s.startsWith('google-');
}

export function consultaIdRank(id: string): number {
  if (!isLegacyConsultaId(id)) return 3;
  if (String(id).startsWith('local-')) return 2;
  return 1;
}

export function preferCanonicalConsultaId(a: string, b: string): string {
  return consultaIdRank(a) >= consultaIdRank(b) ? a : b;
}

async function loadIdByGoogleEventIdForOwner(
  owner: string,
  googleEventIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(googleEventIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id, google_event_id')
    .eq('owner_email', owner)
    .in('google_event_id', ids);

  if (error) throw error;
  for (const row of data ?? []) {
    if (!row.google_event_id) continue;
    const gid = String(row.google_event_id);
    const existing = map.get(gid);
    map.set(gid, existing ? preferCanonicalConsultaId(existing, String(row.id)) : String(row.id));
  }
  return map;
}

/** Remove linhas duplicadas com o mesmo google_event_id (race local vs Google sync). */
async function dedupeGoogleEventIdRows(
  owner: string,
  googleEventIds: string[],
): Promise<void> {
  const unique = [...new Set(googleEventIds.filter(Boolean))];
  if (unique.length === 0) return;

  for (const gid of unique) {
    const { data: rows, error } = await supabaseAdmin
      .from('consultas_agenda')
      .select('id')
      .eq('owner_email', owner)
      .eq('google_event_id', gid);

    if (error) throw error;
    if (!rows || rows.length <= 1) continue;

    const keepId = rows
      .map((r) => String(r.id))
      .reduce((best, id) => preferCanonicalConsultaId(best, id));
    const deleteIds = rows.map((r) => String(r.id)).filter((id) => id !== keepId);
    if (deleteIds.length === 0) continue;

    const { error: delErr } = await supabaseAdmin
      .from('consultas_agenda')
      .delete()
      .eq('owner_email', owner)
      .in('id', deleteIds);
    if (delErr) throw delErr;
  }
}

/** Remove outras linhas com o mesmo google_event_id (evita fantasma sem apagar). */
async function deleteOtherRowsWithGoogleEventId(
  owner: string,
  keepConsultaId: string,
  googleEventId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('consultas_agenda')
    .delete()
    .eq('owner_email', owner)
    .eq('google_event_id', googleEventId)
    .neq('id', keepConsultaId);

  if (error) throw error;
}

export function isConsultasAgendaTableMissing(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST205' || (error.message?.includes('consultas_agenda') ?? false);
}

/** Chave lógica da consulta (mesmo paciente/horário/WhatsApp = mesmo lembrete). */
export function consultaLogicalKey(row: {
  inicio: string;
  telefone: string | null;
  paciente: string;
}): string {
  const phone = row.telefone ?? '';
  const paciente = row.paciente.trim().toLowerCase();
  const time = new Date(row.inicio).toLocaleTimeString('en-GB', {
    timeZone: BR_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${phone}|${brDateKey(row.inicio)}|${time}|${paciente}`;
}

export function pickBetterConsultaRowForLembretes(
  a: ConsultaAgendaRow,
  b: ConsultaAgendaRow,
): ConsultaAgendaRow {
  const rankA = consultaIdRank(a.id);
  const rankB = consultaIdRank(b.id);
  if (rankA !== rankB) return rankA > rankB ? a : b;
  if (a.google_event_id && !b.google_event_id) return a;
  if (b.google_event_id && !a.google_event_id) return b;
  if (a.telefone && !b.telefone) return a;
  if (b.telefone && !a.telefone) return b;
  if (a.cliente_drive_id && !b.cliente_drive_id) return a;
  if (b.cliente_drive_id && !a.cliente_drive_id) return b;
  if (a.observacoes?.trim() && !b.observacoes?.trim()) return a;
  if (b.observacoes?.trim() && !a.observacoes?.trim()) return b;
  return a;
}

function pickBetterConsultaRow(
  a: ConsultaAgendaRow,
  b: ConsultaAgendaRow,
): ConsultaAgendaRow {
  return pickBetterConsultaRowForLembretes(a, b);
}

/** Mesmo slot na agenda (data + hora + profissional em SP). */
export function consultaSlotKey(row: {
  inicio: string;
  medico: string | null;
}): string {
  const time = new Date(row.inicio).toLocaleTimeString('en-GB', {
    timeZone: BR_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${brDateKey(row.inicio)}|${time}|${(row.medico ?? '').trim().toLowerCase()}`;
}

/** Mesmo horário (±1 min) e médico compatível — alinhado a sameAppointmentSlot no cliente. */
export function consultaRowsSameSlot(
  a: { inicio: string; medico: string | null },
  b: { inicio: string; medico: string | null },
): boolean {
  const ta = new Date(a.inicio).getTime();
  const tb = new Date(b.inicio).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  if (Math.abs(ta - tb) > 60_000) return false;
  const medicoA = (a.medico ?? '').trim().toLowerCase();
  const medicoB = (b.medico ?? '').trim().toLowerCase();
  if (medicoA && medicoB && medicoA !== medicoB) return false;
  return true;
}

export function dedupeConsultasRows(rows: ConsultaAgendaRow[]): ConsultaAgendaRow[] {
  if (rows.length <= 1) return rows;

  const consumed = new Set<number>();
  const result: ConsultaAgendaRow[] = [];

  const byGoogle = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const gid = rows[i].google_event_id;
    if (!gid) continue;
    const key = String(gid);
    if (!byGoogle.has(key)) byGoogle.set(key, []);
    byGoogle.get(key)!.push(i);
  }

  for (const group of byGoogle.values()) {
    let merged = rows[group[0]];
    for (const idx of group.slice(1)) {
      merged = pickBetterConsultaRow(merged, rows[idx]);
      consumed.add(idx);
    }
    for (let i = 0; i < rows.length; i++) {
      if (consumed.has(i) || rows[i].google_event_id) continue;
      if (consultaRowsSameSlot(rows[i], merged)) {
        merged = pickBetterConsultaRow(merged, rows[i]);
        consumed.add(i);
      }
    }
    consumed.add(group[0]);
    result.push(merged);
  }

  const orphans: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (!consumed.has(i)) orphans.push(i);
  }

  const orphanConsumed = new Set<number>();
  for (const i of orphans) {
    if (orphanConsumed.has(i)) continue;
    let merged = rows[i];
    orphanConsumed.add(i);
    for (const j of orphans) {
      if (orphanConsumed.has(j) || j === i) continue;
      if (consultaRowsSameSlot(rows[i], rows[j])) {
        merged = pickBetterConsultaRow(merged, rows[j]);
        orphanConsumed.add(j);
      }
    }
    result.push(merged);
  }

  return result;
}

type ConsultaIdIndexRow = Pick<
  ConsultaAgendaRow,
  'id' | 'google_event_id' | 'inicio' | 'medico'
>;

export function resolveStableConsultaId(
  row: ConsultaIdIndexRow,
  ownerRows: ConsultaIdIndexRow[],
): string {
  if (!isLegacyConsultaId(row.id)) return row.id;

  if (row.google_event_id) {
    const byGid = ownerRows.find(
      (r) => r.google_event_id === row.google_event_id && !isLegacyConsultaId(r.id),
    );
    if (byGid) return byGid.id;
  }

  const bySlot = ownerRows.find(
    (r) => consultaRowsSameSlot(r, row) && !isLegacyConsultaId(r.id),
  );
  if (bySlot) return bySlot.id;

  return randomUUID();
}

export async function repairConsultasAgendaForOwner(ownerEmail: string): Promise<{
  deleted: number;
  migrated: number;
}> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner);

  if (error) throw error;

  const all = (data ?? []) as ConsultaAgendaRow[];
  const kept = dedupeConsultasRows(all);
  const keepIdSet = new Set(kept.map((r) => r.id));
  const deleteIds = new Set(all.filter((r) => !keepIdSet.has(r.id)).map((r) => r.id));
  let migrated = 0;
  const now = new Date().toISOString();

  for (const row of kept) {
    if (!isLegacyConsultaId(row.id)) continue;
    const newId = randomUUID();
    const { error: upErr } = await supabaseAdmin.from('consultas_agenda').upsert({
      ...row,
      id: newId,
      owner_email: owner,
      updated_at: now,
    });
    if (upErr) throw upErr;
    deleteIds.add(row.id);
    migrated += 1;
  }

  if (deleteIds.size === 0) return { deleted: 0, migrated };

  const { error: delErr } = await supabaseAdmin
    .from('consultas_agenda')
    .delete()
    .eq('owner_email', owner)
    .in('id', [...deleteIds]);

  if (delErr) throw delErr;
  return { deleted: deleteIds.size, migrated };
}

/** Remove duplicatas no Supabase (ex.: local-* e google-* do mesmo horário). */
export async function pruneDuplicatesForOwner(ownerEmail: string): Promise<number> {
  const { deleted } = await repairConsultasAgendaForOwner(ownerEmail);
  return deleted;
}

export async function listConsultasAgendaForOwner(
  ownerEmail: string,
  options?: { daysPast?: number; daysFuture?: number },
): Promise<ConsultaAgendaRow[]> {
  const daysPast = options?.daysPast ?? 180;
  const daysFuture = options?.daysFuture ?? 365;
  const owner = ownerEmail.toLowerCase().trim();
  const minDate = new Date(Date.now() - daysPast * MS_DAY).toISOString();
  const maxDate = new Date(Date.now() + daysFuture * MS_DAY).toISOString();

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .gte('inicio', minDate)
    .lte('inicio', maxDate)
    .order('inicio', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ConsultaAgendaRow[];
}

export async function deleteConsultasAgenda(
  ownerEmail: string,
  options: { ids?: string[]; googleEventIds?: string[] },
): Promise<{ deleted: number }> {
  const owner = ownerEmail.toLowerCase().trim();
  let deleted = 0;

  const ids = [...new Set((options.ids ?? []).map(String).filter(Boolean))];
  if (ids.length > 0) {
    const { error, count } = await supabaseAdmin
      .from('consultas_agenda')
      .delete({ count: 'exact' })
      .eq('owner_email', owner)
      .in('id', ids);
    if (error) throw error;
    deleted += count ?? 0;
  }

  const googleEventIds = [...new Set((options.googleEventIds ?? []).map(String).filter(Boolean))];
  if (googleEventIds.length > 0) {
    const { error, count } = await supabaseAdmin
      .from('consultas_agenda')
      .delete({ count: 'exact' })
      .eq('owner_email', owner)
      .in('google_event_id', googleEventIds);
    if (error) throw error;
    deleted += count ?? 0;
  }

  return { deleted };
}

export async function upsertConsultasAgenda(
  ownerEmail: string,
  consultas: ConsultaSyncInput[],
): Promise<{ upserted: number }> {
  const owner = ownerEmail.toLowerCase().trim();
  const now = new Date().toISOString();
  const rows = consultas
    .filter((c) => c.id && c.paciente?.trim() && c.inicio)
    .map((c) => ({
      id: String(c.id),
      owner_email: owner,
      paciente: c.paciente.trim(),
      servico: (c.servico ?? 'Consulta').trim(),
      telefone: c.telefone?.trim()
        ? normalizePhoneDigits(c.telefone)
        : null,
      inicio: c.inicio,
      fim: c.fim ?? null,
      local: c.local ?? null,
      google_event_id: c.google_event_id ?? null,
      medico: c.medico ?? null,
      convenio: c.convenio ?? null,
      status: c.status ?? 'agendado',
      lembretes_whatsapp: c.lembretes_whatsapp !== false,
      cliente_drive_id: c.cliente_drive_id ?? null,
      tipo_consulta: c.tipo_consulta ?? null,
      observacoes: c.observacoes?.trim() ? c.observacoes.trim() : null,
      updated_at: now,
    }));

  if (rows.length === 0) return { upserted: 0 };

  const { data: ownerIndexRows, error: indexErr } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id, google_event_id, inicio, medico')
    .eq('owner_email', owner);
  if (indexErr) throw indexErr;
  const ownerIndex = (ownerIndexRows ?? []) as ConsultaIdIndexRow[];

  const rowsWithStableIds = rows.map((row) => ({
    ...row,
    id: resolveStableConsultaId(row, ownerIndex),
  }));

  const googleEventIds = rowsWithStableIds
    .map((r) => r.google_event_id)
    .filter((gid): gid is string => !!gid);
  const idByGoogleEvent = await loadIdByGoogleEventIdForOwner(owner, googleEventIds);

  const canonicalRows = rowsWithStableIds.map((row) => {
    const gid = row.google_event_id;
    if (!gid) return row;
    const existingId = idByGoogleEvent.get(gid);
    if (!existingId || existingId === row.id) return row;
    return { ...row, id: preferCanonicalConsultaId(row.id, existingId) };
  });

  const ids = canonicalRows.map((r) => r.id);
  const existingById = new Map<
    string,
    Pick<
      ConsultaAgendaRow,
      | 'telefone'
      | 'cliente_drive_id'
      | 'medico'
      | 'lembretes_whatsapp'
      | 'status'
      | 'observacoes'
      | 'tipo_consulta'
    >
  >();

  if (ids.length > 0) {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('consultas_agenda')
      .select(
        'id, telefone, cliente_drive_id, medico, lembretes_whatsapp, status, observacoes, tipo_consulta',
      )
      .eq('owner_email', owner)
      .in('id', ids);
    if (fetchErr) throw fetchErr;
    for (const row of existing ?? []) {
      existingById.set(String(row.id), row);
    }
  }

  /** Sync em massa (ex.: Google) não apaga telefone/médico/lembrete/status já avançados no Supabase. */
  const mergedRows = canonicalRows.map((row) => {
    const prev = existingById.get(row.id);
    if (!prev) return row;
    return {
      ...row,
      telefone: row.telefone ?? prev.telefone ?? null,
      cliente_drive_id: row.cliente_drive_id ?? prev.cliente_drive_id ?? null,
      medico: row.medico ?? prev.medico ?? null,
      tipo_consulta: row.tipo_consulta ?? prev.tipo_consulta ?? null,
      status: preferConsultaStatus(prev.status, row.status),
      lembretes_whatsapp:
        prev.lembretes_whatsapp === false ? false : row.lembretes_whatsapp,
      observacoes: row.observacoes?.trim() ? row.observacoes : prev.observacoes ?? null,
    };
  });

  for (const row of mergedRows) {
    if (!row.google_event_id) continue;
    await deleteOtherRowsWithGoogleEventId(owner, row.id, row.google_event_id);
  }

  const { error } = await supabaseAdmin.from('consultas_agenda').upsert(mergedRows, {
    onConflict: 'id',
  });

  if (error) throw error;

  const touchedGoogleIds = mergedRows
    .map((r) => r.google_event_id)
    .filter((gid): gid is string => !!gid);
  if (touchedGoogleIds.length > 0) {
    await dedupeGoogleEventIdRows(owner, touchedGoogleIds);
  }

  await pruneDuplicatesForOwner(ownerEmail);

  return { upserted: mergedRows.length };
}

export async function updateConsultaAgendaStatus(
  consultaId: string,
  ownerEmail: string,
  status: ConsultaStatus,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', consultaId)
    .eq('owner_email', ownerEmail.toLowerCase().trim())
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function getConsultaAgendaById(
  consultaId: string,
): Promise<ConsultaAgendaRow | null> {
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('id', consultaId)
    .maybeSingle();

  if (error) throw error;
  return data as ConsultaAgendaRow | null;
}

export async function consultaBelongsToOwner(
  consultaId: string,
  ownerEmail: string,
): Promise<boolean> {
  const owner = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('id')
    .eq('id', consultaId)
    .eq('owner_email', owner)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export type LembreteTipo = 'd7' | 'd1';

function windowForTipo(tipo: LembreteTipo): { minMs: number; maxMs: number } {
  const now = Date.now();
  if (tipo === 'd7') {
    const target = 7 * MS_DAY;
    return { minMs: target - 12 * 60 * 60 * 1000, maxMs: target + 12 * 60 * 60 * 1000 };
  }
  const target = MS_DAY;
  return { minMs: target - 6 * 60 * 60 * 1000, maxMs: target + 6 * 60 * 60 * 1000 };
}

export async function listConsultasParaLembrete(tipo: LembreteTipo): Promise<ConsultaAgendaRow[]> {
  const { minMs, maxMs } = windowForTipo(tipo);
  const minDate = new Date(Date.now() + minMs).toISOString();
  const maxDate = new Date(Date.now() + maxMs).toISOString();

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('lembretes_whatsapp', true)
    .in('status', ['agendado', 'confirmado'])
    .gte('inicio', minDate)
    .lte('inicio', maxDate)
    .not('telefone', 'is', null);

  if (error) throw error;
  return (data ?? []) as ConsultaAgendaRow[];
}

export async function wasLembreteEnviado(
  consultaId: string,
  tipo: LembreteTipo,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_lembrete_enviado')
    .select('id')
    .eq('consulta_id', consultaId)
    .eq('lembrete_tipo', tipo)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') return false;
    throw error;
  }
  return !!data;
}

export async function wasLembreteDispensado(
  consultaId: string,
  tipo: LembreteTipo,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_lembrete_dispensado')
    .select('id')
    .eq('consulta_id', consultaId)
    .eq('lembrete_tipo', tipo)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205') return false;
    throw error;
  }
  return !!data;
}

export async function markLembreteDispensado(params: {
  consultaId: string;
  ownerEmail: string;
  tipo: LembreteTipo;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('whatsapp_lembrete_dispensado').insert({
    consulta_id: params.consultaId,
    owner_email: params.ownerEmail.toLowerCase().trim(),
    lembrete_tipo: params.tipo,
  });

  if (error && error.code !== '23505' && error.code !== 'PGRST205') throw error;
}

export async function markLembreteEnviado(params: {
  consultaId: string;
  ownerEmail: string;
  tipo: LembreteTipo | 'criacao';
  filaId?: string;
}): Promise<void> {
  const owned = await consultaBelongsToOwner(params.consultaId, params.ownerEmail);
  if (!owned) return;

  const { error } = await supabaseAdmin.from('whatsapp_lembrete_enviado').insert({
    consulta_id: params.consultaId,
    owner_email: params.ownerEmail.toLowerCase().trim(),
    lembrete_tipo: params.tipo,
    fila_id: params.filaId ?? null,
  });

  if (error && error.code !== '23505') throw error;
}

function brDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function brTodayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export { brDateKey };

/** Limites do dia (America/Sao_Paulo) para consultas_agenda.inicio. */
export function dayBoundsSp(targetKey: string): { start: string; end: string } {
  const dayStart = new Date(`${targetKey}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { start: dayStart.toISOString(), end: dayEnd.toISOString() };
}

export async function queryConsultasAgendaForDay(
  ownerEmail: string,
  targetKey: string,
): Promise<ConsultaAgendaRow[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const { start, end } = dayBoundsSp(targetKey);

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .eq('lembretes_whatsapp', true)
    .in('status', ['agendado', 'confirmado'])
    .gte('inicio', start)
    .lt('inicio', end);

  if (error) throw error;
  return (data ?? []) as ConsultaAgendaRow[];
}

export async function listConsultasLembretesManuais(
  ownerEmail: string,
  tipo: LembreteTipo,
  settings?: LembretesWhatsappSettings,
): Promise<ConsultaAgendaRow[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const s = settings ?? (await getLembretesSettings(owner));
  if (tipo === 'd7' && !s.lembrete_antecedencia_ativo) return [];
  if (tipo === 'd1' && !s.lembrete_1_dia_ativo) return [];

  await pruneDuplicatesForOwner(owner);

  const offset = tipo === 'd7' ? s.lembrete_antecedencia_dias : 1;
  const targetKey = addDaysToKey(brTodayKey(), offset);

  const { data, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .eq('lembretes_whatsapp', true)
    .in('status', ['agendado', 'confirmado'])
    .not('telefone', 'is', null);

  if (error) throw error;

  const allRows = (data ?? []) as ConsultaAgendaRow[];
  const idsByLogicalKey = new Map<string, string[]>();
  for (const row of allRows) {
    const key = consultaLogicalKey(row);
    const ids = idsByLogicalKey.get(key) ?? [];
    ids.push(row.id);
    idsByLogicalKey.set(key, ids);
  }

  const rows = dedupeConsultasRows(allRows);
  const filtered: ConsultaAgendaRow[] = [];

  for (const row of rows) {
    if (brDateKey(row.inicio) !== targetKey) continue;
    const siblingIds = idsByLogicalKey.get(consultaLogicalKey(row)) ?? [row.id];
    let hidden = false;
    for (const id of siblingIds) {
      if (
        (await wasLembreteEnviado(id, tipo)) ||
        (await wasLembreteDispensado(id, tipo))
      ) {
        hidden = true;
        break;
      }
    }
    if (!hidden) filtered.push(row);
  }

  return filtered.sort((a, b) => a.inicio.localeCompare(b.inicio));
}
