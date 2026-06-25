import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import type { ConsultaStatus, TipoConsulta } from '@/lib/consultations';
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

export function dedupeConsultasRows(rows: ConsultaAgendaRow[]): ConsultaAgendaRow[] {
  const map = new Map<string, ConsultaAgendaRow>();
  for (const row of rows) {
    const key = consultaSlotKey(row);
    const prev = map.get(key);
    map.set(key, prev ? pickBetterConsultaRow(prev, row) : row);
  }
  return [...map.values()];
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

  const slot = consultaSlotKey(row);
  const bySlot = ownerRows.find(
    (r) => consultaSlotKey(r) === slot && !isLegacyConsultaId(r.id),
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

  const { error } = await supabaseAdmin.from('consultas_agenda').upsert(rowsWithStableIds, {
    onConflict: 'id',
  });

  if (error) throw error;

  await pruneDuplicatesForOwner(ownerEmail);

  return { upserted: rowsWithStableIds.length };
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
