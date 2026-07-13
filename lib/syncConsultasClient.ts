import type { ConsultationRecord, ConsultaStatus } from '@/lib/consultations';
import { parseEventDate, resolveConsultaStatus } from '@/lib/consultations';

const fetchOpts = { cache: 'no-store' as RequestCache };

export type ServerConsultaRow = {
  id: string;
  status?: string;
  inicio: string;
  fim?: string | null;
  paciente?: string;
  servico?: string;
  telefone?: string | null;
  local?: string | null;
  google_event_id?: string | null;
  google_profissional_id?: string | null;
  medico?: string | null;
  convenio?: string | null;
  lembretes_whatsapp?: boolean;
  cliente_drive_id?: string | null;
  observacoes?: string | null;
};

export function consultationToSyncPayload(ev: ConsultationRecord) {
  const start = parseEventDate(ev.start);
  const end = parseEventDate(ev.end);
  if (!start || !ev.id) return null;
  return {
    id: String(ev.id),
    patient: ev.patient?.trim() || 'Paciente',
    service: ev.service,
    telefone: ev.telefone ?? null,
    start: start.toISOString(),
    end: end?.toISOString() ?? null,
    location: ev.location,
    googleEventId: ev.googleEventId,
    googleProfissionalId: ev.googleProfissionalId,
    medico: ev.medico,
    convenio: ev.convenio,
    status: ev.status ?? 'agendado',
    lembretesWhatsapp: ev.lembretesWhatsapp !== false,
    clienteDriveId: ev.clienteDriveId ?? null,
    tipoConsulta: ev.tipoConsulta ?? null,
    observacoes: ev.observacoes?.trim() ? ev.observacoes.trim() : null,
  };
}

export function eventMergeKey(ev: ConsultationRecord): string {
  if (ev.googleEventId) return `g:${ev.googleEventId}`;
  return `id:${String(ev.id)}`;
}

export function consultationRichness(ev: ConsultationRecord): number {
  let score = 0;
  if (ev.googleEventId) score += 2;
  if (ev.telefone?.trim()) score += 4;
  if (ev.medico?.trim()) score += 4;
  if (ev.payment) score += 8;
  if (ev.clienteDriveId) score += 2;
  const patient = ev.patient?.trim().toLowerCase();
  if (patient && patient !== 'paciente' && patient !== 'google') score += 2;
  if (ev.observacoes?.trim()) score += 1;
  return score;
}

function isGenericPatient(patient?: string): boolean {
  const p = patient?.trim().toLowerCase();
  return !p || p === 'paciente' || p === 'google';
}

function normalizedProfissionalName(value?: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

/** Mesmo horário (±1 min) e mesmo médico, se informado. */
export function sameAppointmentSlot(a: ConsultationRecord, b: ConsultationRecord): boolean {
  const ta = parseEventDate(a.start)?.getTime();
  const tb = parseEventDate(b.start)?.getTime();
  if (ta == null || tb == null) return false;
  if (Math.abs(ta - tb) > 60_000) return false;
  const medicoA = a.medico?.trim().toLowerCase() ?? '';
  const medicoB = b.medico?.trim().toLowerCase() ?? '';
  if (medicoA && medicoB && medicoA !== medicoB) return false;
  return true;
}

/** Escolhe start/end na mescla: servidor/Google devem vencer sobre cache local rico. */
function pickScheduleOnMerge(
  a: ConsultationRecord,
  b: ConsultationRecord,
  options?: { scheduleFromB?: boolean },
): Pick<ConsultationRecord, 'start' | 'end'> {
  if (options?.scheduleFromB) {
    return { start: b.start, end: b.end };
  }

  const gidA = a.googleEventId ? String(a.googleEventId) : '';
  const gidB = b.googleEventId ? String(b.googleEventId) : '';
  if (gidA && gidA === gidB) {
    const ta = parseEventDate(a.start)?.getTime();
    const tb = parseEventDate(b.start)?.getTime();
    if (ta != null && tb != null && Math.abs(ta - tb) > 60_000) {
      const aFromGoogle = String(a.id).startsWith('google-');
      const bFromGoogle = String(b.id).startsWith('google-');
      if (aFromGoogle && !bFromGoogle) return { start: a.start, end: a.end };
      if (bFromGoogle && !aFromGoogle) return { start: b.start, end: b.end };
      return { start: b.start, end: b.end };
    }
  }

  const rich = consultationRichness(a) >= consultationRichness(b) ? a : b;
  return { start: rich.start, end: rich.end };
}

function mergeConsultationRecords(
  a: ConsultationRecord,
  b: ConsultationRecord,
  options?: {
    scheduleFromB?: boolean;
    preferScheduleFrom?: 'a' | 'b';
    preferLocalMetadata?: boolean;
  },
): ConsultationRecord {
  const rich = consultationRichness(a) >= consultationRichness(b) ? a : b;
  const sparse = rich === a ? b : a;
  const googleEventId =
    a.googleEventId ?? b.googleEventId ?? rich.googleEventId ?? sparse.googleEventId;
  const payment = rich.payment ?? sparse.payment;
  const schedule =
    options?.preferScheduleFrom === 'a'
      ? { start: a.start, end: a.end }
      : options?.preferScheduleFrom === 'b'
        ? { start: b.start, end: b.end }
        : pickScheduleOnMerge(a, b, options);

  const preferLocalMeta = options?.preferLocalMetadata === true;
  const localSide = options?.scheduleFromB ? a : preferLocalMeta ? a : rich;
  const serverSide = options?.scheduleFromB ? b : preferLocalMeta ? b : sparse;

  return {
    ...rich,
    id: String(rich.id),
    start: schedule.start,
    end: schedule.end,
    googleEventId,
    googleProfissionalId:
      a.googleProfissionalId ??
      b.googleProfissionalId ??
      rich.googleProfissionalId ??
      sparse.googleProfissionalId,
    patient: !isGenericPatient(rich.patient) ? rich.patient : sparse.patient || rich.patient,
    telefone: rich.telefone ?? sparse.telefone,
    medico: rich.medico ?? sparse.medico,
    service: preferLocalMeta
      ? localSide.service?.trim() || serverSide.service || rich.service
      : rich.service ?? sparse.service,
    location: rich.location ?? sparse.location,
    payment,
    tipoConsulta: rich.tipoConsulta ?? sparse.tipoConsulta,
    value: rich.value ?? sparse.value,
    observacoes: preferLocalMeta
      ? localSide.observacoes?.trim() || serverSide.observacoes || rich.observacoes
      : rich.observacoes ?? sparse.observacoes,
    clienteDriveId: rich.clienteDriveId ?? sparse.clienteDriveId,
    status: resolveConsultaStatus(rich.status, sparse.status, payment),
    lembretesWhatsapp: rich.lembretesWhatsapp,
  };
}

/** Outro registro que representa o mesmo agendamento (googleEventId ou horário+médico). */
export function findDuplicatePartner(
  target: ConsultationRecord,
  events: ConsultationRecord[],
): ConsultationRecord | null {
  return findAllDuplicatePartners(target, events)[0] ?? null;
}

/** Todas as cópias do mesmo agendamento (para exclusão em cascata). */
export function findAllDuplicatePartners(
  target: ConsultationRecord,
  events: ConsultationRecord[],
): ConsultationRecord[] {
  const partners: ConsultationRecord[] = [];
  for (const ev of events) {
    if (String(ev.id) === String(target.id)) continue;
    if (target.googleEventId && ev.googleEventId === target.googleEventId) {
      partners.push(ev);
      continue;
    }
    if (sameAppointmentSlot(target, ev)) partners.push(ev);
  }
  return partners;
}

export type ConsultaRemovePlan = {
  idsToDelete: string[];
  /** Só preenchido quando o registro excluído pelo usuário tem evento Google. */
  googleEventId?: string;
  googleProfissionalId?: string;
};

/**
 * Define o que apagar ao excluir um agendamento:
 * - Fantasma (menos dados / sem paciente): só a linha clicada, sem Google.
 * - Canônico: linha clicada + cópias mais esparsas no Supabase; Google só se a linha clicada tiver vínculo.
 */
export function planConsultaRemoval(
  event: ConsultationRecord,
  events: ConsultationRecord[],
): ConsultaRemovePlan {
  const id = String(event.id);
  const partners = findAllDuplicatePartners(event, events);
  const richerPartner = partners.find(
    (p) => consultationRichness(p) > consultationRichness(event),
  );

  if (richerPartner) {
    return { idsToDelete: [id] };
  }

  const idsToDelete = [id];
  for (const p of partners) {
    if (consultationRichness(p) < consultationRichness(event)) {
      idsToDelete.push(String(p.id));
    }
  }

  const googleEventId = event.googleEventId ? String(event.googleEventId) : undefined;
  return {
    idsToDelete: [...new Set(idsToDelete)],
    googleEventId,
    googleProfissionalId: event.googleProfissionalId,
  };
}

/** Remove duplicatas (googleEventId, id local órfão ou mesmo horário). */
export function dedupeConsultations(events: ConsultationRecord[]): ConsultationRecord[] {
  if (events.length <= 1) return events;

  const consumed = new Set<number>();
  const result: ConsultationRecord[] = [];

  const byGoogle = new Map<string, number[]>();
  for (let i = 0; i < events.length; i++) {
    const gid = events[i].googleEventId;
    if (!gid) continue;
    const key = String(gid);
    if (!byGoogle.has(key)) byGoogle.set(key, []);
    byGoogle.get(key)!.push(i);
  }

  for (const group of byGoogle.values()) {
    let merged = events[group[0]];
    for (const idx of group.slice(1)) {
      merged = mergeConsultationRecords(merged, events[idx]);
      consumed.add(idx);
    }
    for (let i = 0; i < events.length; i++) {
      if (consumed.has(i) || events[i].googleEventId) continue;
      if (sameAppointmentSlot(events[i], merged)) {
        merged = mergeConsultationRecords(merged, events[i]);
        consumed.add(i);
      }
    }
    consumed.add(group[0]);
    result.push(merged);
  }

  const orphans: number[] = [];
  for (let i = 0; i < events.length; i++) {
    if (!consumed.has(i)) orphans.push(i);
  }

  const orphanConsumed = new Set<number>();
  for (const i of orphans) {
    if (orphanConsumed.has(i)) continue;
    let merged = events[i];
    orphanConsumed.add(i);
    for (const j of orphans) {
      if (orphanConsumed.has(j) || j === i) continue;
      if (sameAppointmentSlot(events[i], events[j])) {
        merged = mergeConsultationRecords(merged, events[j]);
        orphanConsumed.add(j);
      }
    }
    result.push(merged);
  }

  return result.sort((a, b) => {
    const ta = parseEventDate(a.start)?.getTime() ?? 0;
    const tb = parseEventDate(b.start)?.getTime() ?? 0;
    return tb - ta;
  });
}

/** Mescla eventos do Google na lista local (anexa googleEventId ao registro rico existente). */
export function mergeGoogleCalendarEvents(
  current: ConsultationRecord[],
  googleEvents: ConsultationRecord[],
): ConsultationRecord[] {
  const next = [...current];

  for (const ge of googleEvents) {
    if (!ge.googleEventId) continue;
    const gid = String(ge.googleEventId);

    const byGoogleIdx = next.findIndex((e) => e.googleEventId === gid);
    if (byGoogleIdx >= 0) {
      next[byGoogleIdx] = mergeConsultationRecords(next[byGoogleIdx], ge, {
        scheduleFromB: true,
      });
      continue;
    }

    const slotIdx = next.findIndex(
      (e) => !e.googleEventId && sameAppointmentSlot(e, ge),
    );
    if (slotIdx >= 0) {
      next[slotIdx] = mergeConsultationRecords(next[slotIdx], ge, {
        scheduleFromB: true,
      });
      continue;
    }

    next.push(ge);
  }

  return dedupeConsultations(next);
}

export function serverRowToConsultation(row: ServerConsultaRow): ConsultationRecord {
  const googleEventId = row.google_event_id ?? undefined;
  const googleProfissionalId = row.google_profissional_id ?? undefined;
  return {
    id: String(row.id),
    patient: row.paciente ?? '',
    service: row.servico ?? 'Consulta médica',
    telefone: row.telefone ?? undefined,
    start: row.inicio,
    end: row.fim ?? undefined,
    location: row.local ?? undefined,
    googleEventId,
    googleProfissionalId,
    medico: row.medico ?? undefined,
    convenio: row.convenio ?? undefined,
    status: (row.status as ConsultaStatus) ?? 'agendado',
    lembretesWhatsapp: row.lembretes_whatsapp !== false,
    clienteDriveId: row.cliente_drive_id ?? undefined,
    observacoes: row.observacoes ?? undefined,
  };
}

/** Mescla local + servidor: metadados ricos do local; horário do servidor (multi-dispositivo). */
export function mergeConsultationsWithServer(
  local: ConsultationRecord[],
  server: ConsultationRecord[],
): ConsultationRecord[] {
  const byKey = new Map<string, ConsultationRecord>();

  for (const ev of local) {
    byKey.set(eventMergeKey(ev), ev);
  }

  for (const ev of server) {
    const key = eventMergeKey(ev);
    const existing = byKey.get(key);
    if (existing) {
      const payment = existing.payment ?? ev.payment;
      const profissionalChanged =
        normalizedProfissionalName(existing.medico) !==
        normalizedProfissionalName(ev.medico);
      const merged = mergeConsultationRecords(
        existing,
        {
          ...ev,
          payment,
          status: resolveConsultaStatus(existing.status, ev.status, payment),
          tipoConsulta: existing.tipoConsulta ?? ev.tipoConsulta,
          value: existing.value ?? ev.value,
          observacoes: ev.observacoes?.trim()
            ? ev.observacoes
            : existing.observacoes,
        },
        { scheduleFromB: true },
      );
      byKey.set(
        key,
        profissionalChanged
          ? {
              ...merged,
              medico: ev.medico ?? undefined,
              googleProfissionalId: ev.googleProfissionalId ?? undefined,
            }
          : merged,
      );
    } else {
      byKey.set(key, ev);
    }
  }

  return dedupeConsultations(Array.from(byKey.values()));
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** local-* em sync imediato — não reenviar no debounce de 800ms. */
const immediateSyncLocalIds = new Set<string>();

export function trackImmediateConsultaSync(...ids: string[]): void {
  for (const id of ids) {
    const s = String(id).trim();
    if (s) immediateSyncLocalIds.add(s);
  }
}

export function untrackImmediateConsultaSync(...ids: string[]): void {
  for (const id of ids) {
    immediateSyncLocalIds.delete(String(id));
  }
}

const PENDING_SERVER_CONFIRM_MS = 60_000;
const pendingServerConfirmUntil = new Map<string, number>();

type PendingScheduleOverride = {
  start: string;
  end?: string;
  until: number;
};

type PendingMetadataOverride = {
  service?: string;
  observacoes?: string;
  googleEventId?: string;
  googleProfissionalId?: string;
  until: number;
};

const pendingScheduleOverride = new Map<string, PendingScheduleOverride>();
const pendingMetadataOverride = new Map<string, PendingMetadataOverride>();

function pendingConfirmKeys(ev: ConsultationRecord): string[] {
  const keys = [String(ev.id)];
  if (ev.googleEventId) keys.push(`g:${ev.googleEventId}`);
  return keys;
}

function getPendingScheduleOverride(
  ev: ConsultationRecord,
): PendingScheduleOverride | null {
  const now = Date.now();
  for (const key of pendingConfirmKeys(ev)) {
    const entry = pendingScheduleOverride.get(key);
    if (entry && now < entry.until) return entry;
    if (entry) pendingScheduleOverride.delete(key);
  }
  return null;
}

function getPendingMetadataOverride(
  ev: ConsultationRecord,
): PendingMetadataOverride | null {
  const now = Date.now();
  for (const key of pendingConfirmKeys(ev)) {
    const entry = pendingMetadataOverride.get(key);
    if (entry && now < entry.until) return entry;
    if (entry) pendingMetadataOverride.delete(key);
  }
  return null;
}

function applyPendingScheduleOverride(
  ev: ConsultationRecord,
): ConsultationRecord {
  const override = getPendingScheduleOverride(ev);
  if (!override) return ev;
  return {
    ...ev,
    start: override.start,
    end: override.end,
  };
}

function applyPendingMetadataOverride(
  ev: ConsultationRecord,
): ConsultationRecord {
  const override = getPendingMetadataOverride(ev);
  if (!override) return ev;
  return {
    ...ev,
    service: override.service?.trim() || ev.service,
    observacoes: override.observacoes?.trim()
      ? override.observacoes
      : ev.observacoes,
    googleEventId: override.googleEventId || ev.googleEventId,
    googleProfissionalId:
      override.googleProfissionalId || ev.googleProfissionalId,
  };
}

function normalizeServiceLabel(value?: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

export function consultaMetadataMatches(
  local: ConsultationRecord,
  server: ConsultationRecord,
): boolean {
  const localService = normalizeServiceLabel(local.service);
  const serverService = normalizeServiceLabel(server.service);
  if (localService && serverService && localService !== serverService) {
    return false;
  }
  if (local.googleEventId && !server.googleEventId) return false;
  if (
    local.googleEventId &&
    server.googleEventId &&
    String(local.googleEventId) !== String(server.googleEventId)
  ) {
    return false;
  }
  return true;
}

export function consultaServerConfirmsLocal(
  local: ConsultationRecord,
  server: ConsultationRecord,
): boolean {
  const expected = applyPendingMetadataOverride(
    applyPendingScheduleOverride(local),
  );
  return (
    consultaSchedulesMatch(expected, server) &&
    consultaMetadataMatches(expected, server)
  );
}

export function markConsultaPendingServerConfirmation(
  ev: ConsultationRecord,
  ttlMs = PENDING_SERVER_CONFIRM_MS,
): void {
  const until = Date.now() + ttlMs;
  for (const key of pendingConfirmKeys(ev)) {
    pendingServerConfirmUntil.set(key, until);
  }
}

export function markConsultaPendingMetadata(
  ev: ConsultationRecord,
  ttlMs = PENDING_SERVER_CONFIRM_MS,
): void {
  markConsultaPendingServerConfirmation(ev, ttlMs);
  const entry: PendingMetadataOverride = {
    service: ev.service,
    observacoes: ev.observacoes?.trim() || undefined,
    googleEventId: ev.googleEventId ? String(ev.googleEventId) : undefined,
    googleProfissionalId: ev.googleProfissionalId,
    until: Date.now() + ttlMs,
  };
  for (const key of pendingConfirmKeys(ev)) {
    pendingMetadataOverride.set(key, entry);
  }
}

export function markConsultaPendingScheduleChange(
  ev: ConsultationRecord,
  ttlMs = PENDING_SERVER_CONFIRM_MS,
): void {
  markConsultaPendingServerConfirmation(ev, ttlMs);
  markConsultaPendingMetadata(ev, ttlMs);
  const entry: PendingScheduleOverride = {
    start: String(ev.start),
    end: ev.end ? String(ev.end) : undefined,
    until: Date.now() + ttlMs,
  };
  for (const key of pendingConfirmKeys(ev)) {
    pendingScheduleOverride.set(key, entry);
  }
}

export function clearConsultaPendingServerConfirmation(ev: ConsultationRecord): void {
  for (const key of pendingConfirmKeys(ev)) {
    pendingServerConfirmUntil.delete(key);
    pendingScheduleOverride.delete(key);
    pendingMetadataOverride.delete(key);
  }
}

function isConsultaPendingServerConfirmation(ev: ConsultationRecord): boolean {
  const now = Date.now();
  for (const key of pendingConfirmKeys(ev)) {
    const until = pendingServerConfirmUntil.get(key);
    if (until != null && now < until) return true;
  }
  return false;
}

function hasPendingMetadata(ev: ConsultationRecord): boolean {
  return (
    isConsultaPendingServerConfirmation(ev) ||
    getPendingMetadataOverride(ev) != null ||
    getPendingScheduleOverride(ev) != null
  );
}

export function recoverGoogleLinkFromEvents(
  target: ConsultationRecord,
  events: ConsultationRecord[],
): Pick<ConsultationRecord, 'googleEventId' | 'googleProfissionalId'> {
  if (target.googleEventId) {
    return {
      googleEventId: target.googleEventId,
      googleProfissionalId: target.googleProfissionalId,
    };
  }
  for (const partner of findAllDuplicatePartners(target, events)) {
    if (partner.googleEventId) {
      return {
        googleEventId: String(partner.googleEventId),
        googleProfissionalId: partner.googleProfissionalId,
      };
    }
  }
  return {};
}

export function consultaSchedulesMatch(
  a: ConsultationRecord,
  b: ConsultationRecord,
  toleranceMs = 60_000,
): boolean {
  const aStart = parseEventDate(a.start)?.getTime();
  const bStart = parseEventDate(b.start)?.getTime();
  if (aStart == null || bStart == null) return false;
  if (Math.abs(aStart - bStart) > toleranceMs) return false;
  const aEnd = parseEventDate(a.end)?.getTime();
  const bEnd = parseEventDate(b.end)?.getTime();
  if (aEnd != null && bEnd != null && Math.abs(aEnd - bEnd) > toleranceMs) {
    return false;
  }
  return true;
}

function findServerConsultaMatch(
  ev: ConsultationRecord,
  serverEvents: ConsultationRecord[],
): ConsultationRecord | undefined {
  return serverEvents.find(
    (s) =>
      String(s.id) === String(ev.id) ||
      (ev.googleEventId &&
        s.googleEventId &&
        String(s.googleEventId) === String(ev.googleEventId)),
  );
}

function maybeClearPendingServerConfirmation(
  localEv: ConsultationRecord,
  serverEvents: ConsultationRecord[],
): void {
  if (!hasPendingMetadata(localEv)) return;
  const serverEv = findServerConsultaMatch(localEv, serverEvents);
  if (serverEv && consultaServerConfirmsLocal(localEv, serverEv)) {
    clearConsultaPendingServerConfirmation(localEv);
  }
}

function hasPendingScheduleMismatch(
  localEv: ConsultationRecord,
  serverEv: ConsultationRecord,
): boolean {
  const expectedLocal = applyPendingScheduleOverride(localEv);
  const pending =
    isConsultaPendingServerConfirmation(localEv) ||
    getPendingScheduleOverride(localEv) != null;
  return pending && !consultaSchedulesMatch(expectedLocal, serverEv);
}

/** Ids enviados ao Supabase na última sync — permite DELETE de linhas removidas localmente. */
let lastSyncedIds: Set<string> | null = null;

/** Inicializa snapshot pós-carga do servidor (evita DELETE em massa no primeiro push). */
export function seedConsultasSyncSnapshot(events: ConsultationRecord[]): void {
  lastSyncedIds = new Set(
    dedupeConsultations(events).map((ev) => String(ev.id)),
  );
}

export type ConsultasSyncResult = { ok: true } | { ok: false; error: string };

async function postConsultasSync(
  consultas: NonNullable<ReturnType<typeof consultationToSyncPayload>>[],
): Promise<ConsultasSyncResult> {
  if (consultas.length === 0) return { ok: true };
  const res = await fetch('/api/consultas/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...fetchOpts,
    body: JSON.stringify({ consultas }),
  }).catch(() => null);
  if (!res?.ok) {
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    const error =
      data.error?.trim() ||
      `Falha ao salvar no servidor${res?.status ? ` (${res.status})` : ''}.`;
    console.warn('[syncConsultasClient] sync falhou:', res?.status, error);
    return { ok: false, error };
  }
  const data = (await res.json().catch(() => ({}))) as { upserted?: number };
  const upserted = data.upserted ?? 0;
  if (upserted === 0) {
    return {
      ok: false,
      error:
        'O servidor não confirmou o salvamento da consulta. Tente novamente.',
    };
  }
  return { ok: true };
}

/** PATCH horário no Supabase. */
export async function patchConsultaTimeOnServer(
  ev: ConsultationRecord,
): Promise<
  | { ok: true; inicio: string; fim: string | null }
  | { ok: false; error: string }
> {
  if (typeof window === 'undefined') {
    return { ok: true, inicio: String(ev.start), fim: ev.end ? String(ev.end) : null };
  }
  const start = parseEventDate(ev.start);
  const end = parseEventDate(ev.end);
  if (!start || !ev.id) {
    return { ok: false, error: 'Horário inválido para salvar.' };
  }

  markConsultaPendingScheduleChange(ev);

  try {
    const res = await fetch('/api/consultas/patch-time', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      ...fetchOpts,
      body: JSON.stringify({
        id: String(ev.id),
        inicio: start.toISOString(),
        fim: end?.toISOString() ?? null,
      }),
    });
    if (!res.ok) {
      clearConsultaPendingServerConfirmation(ev);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        error: data.error?.trim() || `Falha ao salvar horário (${res.status})`,
      };
    }
    const data = (await res.json().catch(() => ({}))) as {
      consulta?: { inicio?: string; fim?: string | null };
    };
    const inicio = data.consulta?.inicio ?? start.toISOString();
    const fim = data.consulta?.fim ?? end?.toISOString() ?? null;
    return { ok: true, inicio, fim };
  } catch (err) {
    clearConsultaPendingServerConfirmation(ev);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro de rede ao salvar horário',
    };
  }
}

export type ConsultasDeleteResult = { ok: true } | { ok: false; error: string };

/** Remove consultas do Supabase (por id e/ou googleEventId). */
export async function deleteConsultasFromServer(options: {
  ids?: string[];
  googleEventIds?: string[];
}): Promise<ConsultasDeleteResult> {
  if (typeof window === 'undefined') return { ok: true };
  const ids = options.ids?.filter(Boolean).map(String) ?? [];
  const googleEventIds = options.googleEventIds?.filter(Boolean).map(String) ?? [];
  if (ids.length === 0 && googleEventIds.length === 0) return { ok: true };

  try {
    const { fetchWithTimeout } = await import('@/lib/fetchWithTimeout');
    const res = await fetchWithTimeout(
      '/api/consultas',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        ...fetchOpts,
        body: JSON.stringify({ ids, googleEventIds }),
      },
      25_000,
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        error: data.error?.trim() || `Falha ao excluir (${res.status})`,
      };
    }
    return { ok: true };
  } catch (err) {
    const { isFetchTimeoutError } = await import('@/lib/fetchWithTimeout');
    return {
      ok: false,
      error: isFetchTimeoutError(err)
        ? 'A exclusão demorou demais. Tente de novo.'
        : err instanceof Error
          ? err.message
          : 'Erro de rede ao excluir',
    };
  }
}

/** Sincroniza uma consulta imediatamente (ex.: link calendário no WhatsApp pós-agendar). */
export async function syncConsultaToServerImmediately(
  ev: ConsultationRecord,
): Promise<ConsultasSyncResult> {
  if (typeof window === 'undefined') return { ok: true };
  const payload = consultationToSyncPayload(ev);
  if (!payload) return { ok: false, error: 'Dados da consulta inválidos para salvar.' };

  const trackedId = String(ev.id);
  const wasLocal = isPendingLocalConsulta(ev);
  if (wasLocal) trackImmediateConsultaSync(trackedId);

  try {
    markConsultaPendingScheduleChange(ev);
    markConsultaPendingMetadata(ev);
    const result = await postConsultasSync([payload]);
    if (!result.ok) {
      clearConsultaPendingServerConfirmation(ev);
      return result;
    }
    markConsultaPendingScheduleChange(ev);
    markConsultaPendingMetadata(ev);
    return result;
  } finally {
    if (wasLocal) untrackImmediateConsultaSync(trackedId);
  }
}

/** Envia todas as consultas ao servidor. */
export async function syncAllConsultasToServer(
  events: ConsultationRecord[],
  options?: { serverKeys?: Set<string> },
): Promise<void> {
  if (typeof window === 'undefined') return;
  const pending = listConsultasPendingPush(events, options?.serverKeys);
  if (pending.length === 0) return;

  const consultas = pending
    .map(consultationToSyncPayload)
    .filter((c): c is NonNullable<typeof c> => !!c);
  await postConsultasSync(consultas);
}

/** @deprecated Push em massa substituído por sync por registro + pending push. */
export async function syncFullConsultasListToServer(
  events: ConsultationRecord[],
): Promise<void> {
  if (typeof window === 'undefined') return;
  const deduped = dedupeConsultations(events);
  const consultas = deduped
    .map(consultationToSyncPayload)
    .filter((c): c is NonNullable<typeof c> => !!c);
  await postConsultasSync(consultas);
}

/** googleEventIds em voo (import UI → POST Supabase) — evita sumir no poll antes de persistir. */
const pendingGoogleImportGids = new Set<string>();

export function trackPendingGoogleImports(gids: Iterable<string>): void {
  for (const gid of gids) {
    const s = String(gid).trim();
    if (s) pendingGoogleImportGids.add(s);
  }
}

export function clearPendingGoogleImports(gids: Iterable<string>): void {
  for (const gid of gids) pendingGoogleImportGids.delete(String(gid));
}

/** Import do Calendar ainda não confirmado no Supabase (id google-* ou sync em andamento). */
export function isPendingGoogleImport(
  ev: ConsultationRecord,
  serverKeys: Set<string>,
): boolean {
  const gid = ev.googleEventId ? String(ev.googleEventId) : '';
  if (!gid || serverKeys.has(`g:${gid}`)) return false;
  if (String(ev.id).startsWith('google-')) return true;
  return pendingGoogleImportGids.has(gid);
}

/** Após import Google: sobe só linhas com googleEventId importado (evita regravar cache local antigo). */
export async function syncGoogleImportToServer(
  merged: ConsultationRecord[],
  googleEvents: ConsultationRecord[],
): Promise<void> {
  if (typeof window === 'undefined') return;
  const importedGids = new Set(
    googleEvents
      .map((g) => g.googleEventId)
      .filter((gid): gid is string => !!gid)
      .map(String),
  );
  if (importedGids.size === 0) return;

  trackPendingGoogleImports(importedGids);

  const toSync = merged.filter(
    (ev) => ev.googleEventId && importedGids.has(String(ev.googleEventId)),
  );
  const payloads = dedupeConsultations(toSync)
    .map(consultationToSyncPayload)
    .filter((c): c is NonNullable<typeof c> => !!c);
  if (payloads.length === 0) return;

  const result = await postConsultasSync(payloads);
  if (result.ok) {
    clearPendingGoogleImports(importedGids);
  }
}

async function fetchServerConsultas(): Promise<ConsultationRecord[]> {
  const res = await fetch('/api/consultas', fetchOpts);
  if (!res.ok) return [];
  const data = (await res.json()) as { consultas?: ServerConsultaRow[] };
  const rows = data.consultas;
  if (!rows?.length) return [];
  return rows.map(serverRowToConsultation);
}

async function cleanupDedupedOrphans(
  before: ConsultationRecord[],
  after: ConsultationRecord[],
): Promise<void> {
  const keptIds = new Set(after.map((ev) => String(ev.id)));
  const keptGoogle = new Set(
    after.filter((ev) => ev.googleEventId).map((ev) => String(ev.googleEventId)),
  );

  const orphanIds = before
    .filter((ev) => {
      if (keptIds.has(String(ev.id))) return false;
      if (ev.googleEventId && keptGoogle.has(String(ev.googleEventId))) return true;
      return true;
    })
    .map((ev) => String(ev.id));

  if (orphanIds.length > 0) {
    const del = await deleteConsultasFromServer({ ids: orphanIds });
    if (!del.ok) {
      console.warn('[syncConsultasClient] cleanup orphans:', del.error);
    }
  }
}

const OBSERVACOES_BACKFILL_KEY = 'medsupapp-observacoes-backfill-v1';

export async function backfillObservacoesToServerIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(OBSERVACOES_BACKFILL_KEY)) return;

  const { loadConsultations } = await import('@/lib/consultations');
  const local = loadConsultations();
  const toPush = dedupeConsultations(local).filter(
    (ev) => ev.observacoes?.trim() && !isPendingLocalConsulta(ev),
  );
  if (toPush.length === 0) {
    window.localStorage.setItem(OBSERVACOES_BACKFILL_KEY, '1');
    return;
  }

  await syncFullConsultasListToServer(toPush);
  window.localStorage.setItem(OBSERVACOES_BACKFILL_KEY, '1');
}

/** Preserva nome, observações e vínculos do cache local quando o Supabase veio genérico/vazio. */
export function hydrateServerEventsFromLocal(
  local: ConsultationRecord[],
  serverEvents: ConsultationRecord[],
): ConsultationRecord[] {
  if (local.length === 0) return serverEvents;

  const localById = new Map<string, ConsultationRecord>();
  const localByGid = new Map<string, ConsultationRecord>();
  for (const ev of local) {
    if (ev.id) localById.set(String(ev.id), ev);
    if (ev.googleEventId) localByGid.set(String(ev.googleEventId), ev);
  }

  return serverEvents.map((serverEv) => {
    const localEv =
      localById.get(String(serverEv.id)) ??
      (serverEv.googleEventId
        ? localByGid.get(String(serverEv.googleEventId))
        : undefined);
    if (!localEv || isPendingLocalConsulta(localEv)) return serverEv;
    const effectiveLocal = applyPendingMetadataOverride(
      applyPendingScheduleOverride(localEv),
    );
    const pendingMeta = hasPendingMetadata(localEv);
    const pendingSchedule = hasPendingScheduleMismatch(effectiveLocal, serverEv);
    return mergeConsultationRecords(effectiveLocal, serverEv, {
      scheduleFromB: !pendingSchedule,
      preferScheduleFrom: pendingSchedule ? 'a' : undefined,
      preferLocalMetadata: pendingMeta,
    });
  });
}

/** Mescla pull do servidor: Supabase é fonte de verdade + rascunhos local-* + imports Google pendentes. */
export function mergeServerPullWithLocal(
  local: ConsultationRecord[],
  serverEvents: ConsultationRecord[],
): ConsultationRecord[] {
  const serverKeys = new Set(serverEvents.map(eventMergeKey));
  const base = dedupeConsultations(
    hydrateServerEventsFromLocal(local, serverEvents),
  );

  const pending = local.filter((ev) => {
    if (isPendingLocalConsulta(ev)) {
      return !base.some((s) => sameAppointmentSlot(s, ev));
    }
    if (isPendingGoogleImport(ev, serverKeys)) return true;
    if (
      isConsultaPendingServerConfirmation(ev) ||
      getPendingScheduleOverride(ev) != null
    ) {
      if (!base.some((s) => String(s.id) === String(ev.id) || (ev.googleEventId && s.googleEventId === ev.googleEventId))) {
        return true;
      }
      const onBase = findServerConsultaMatch(ev, base);
      if (onBase && hasPendingScheduleMismatch(ev, onBase)) return true;
    }
    return false;
  });

  if (pending.length === 0) {
    for (const ev of local) {
      maybeClearPendingServerConfirmation(ev, serverEvents);
    }
    return base;
  }

  const next = [...base];
  for (const p of pending) {
    const gid = p.googleEventId ? String(p.googleEventId) : null;
    let slotIdx = p.id
      ? next.findIndex((b) => String(b.id) === String(p.id))
      : -1;
    if (slotIdx < 0 && gid) {
      slotIdx = next.findIndex(
        (b) => b.googleEventId && String(b.googleEventId) === gid,
      );
    }
    if (slotIdx < 0) {
      slotIdx = next.findIndex((b) => sameAppointmentSlot(b, p));
    }
    if (slotIdx >= 0) {
      next[slotIdx] = mergeConsultationRecords(
        next[slotIdx],
        applyPendingScheduleOverride(p),
        { preferScheduleFrom: 'b' },
      );
    } else {
      next.push(p);
    }
  }

  const result = dedupeConsultations(next);
  for (const ev of local) {
    maybeClearPendingServerConfirmation(ev, serverEvents);
  }
  return result;
}

/** Registros que ainda não existem no Supabase (só estes sobem no push em lote). */
export function listConsultasPendingPush(
  events: ConsultationRecord[],
  serverKeys?: Set<string>,
): ConsultationRecord[] {
  return dedupeConsultations(events).filter((ev) => {
    if (immediateSyncLocalIds.has(String(ev.id))) return false;
    if (isPendingLocalConsulta(ev)) return true;
    if (serverKeys && isPendingGoogleImport(ev, serverKeys)) return true;
    return false;
  });
}

function listPendingGoogleImportsToPush(
  merged: ConsultationRecord[],
  serverKeys: Set<string>,
): ConsultationRecord[] {
  return merged.filter(
    (ev) => isPendingGoogleImport(ev, serverKeys) && !isPendingLocalConsulta(ev),
  );
}

/** Consulta criada localmente e ainda não confirmada no Supabase. */
export function isPendingLocalConsulta(ev: ConsultationRecord): boolean {
  const id = String(ev.id ?? '');
  return id.startsWith('local-');
}

/** Puxa Supabase e mescla com local (sem sobrescrever servidor com cache antigo). */
export async function loadAndMergeConsultasFromServer(
  local: ConsultationRecord[],
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return local;

  let serverEvents: ConsultationRecord[] = [];
  try {
    serverEvents = await fetchServerConsultas();
  } catch {
    return dedupeConsultations(local);
  }

  const preDedupe = mergeServerPullWithLocal(local, serverEvents);
  const merged = preDedupe;

  seedConsultasSyncSnapshot(merged);

  if (preDedupe.length > merged.length) {
    await cleanupDedupedOrphans(preDedupe, merged);
  }

  const serverKeys = new Set(serverEvents.map(eventMergeKey));
  const pendingPush = merged.filter(
    (ev) => isPendingLocalConsulta(ev) && !serverKeys.has(eventMergeKey(ev)),
  );
  if (pendingPush.length > 0) {
    await syncAllConsultasToServer(pendingPush, { serverKeys });
  }

  const pendingGoogle = listPendingGoogleImportsToPush(merged, serverKeys);
  if (pendingGoogle.length > 0) {
    await syncGoogleImportToServer(merged, pendingGoogle);
  }

  return merged;
}

/** Atualiza grade a partir do servidor (focus/visibility) — não envia localStorage. */
export async function refreshConsultasFromServer(
  local: ConsultationRecord[],
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return local;

  try {
    const serverEvents = await fetchServerConsultas();
    const serverKeys = new Set(serverEvents.map(eventMergeKey));
    const merged = mergeServerPullWithLocal(local, serverEvents);

    const pendingGoogle = listPendingGoogleImportsToPush(merged, serverKeys);
    if (pendingGoogle.length > 0) {
      await syncGoogleImportToServer(merged, pendingGoogle);
      const serverAfter = await fetchServerConsultas();
      const reconciled = mergeServerPullWithLocal(merged, serverAfter);
      if (reconciled.length < local.length) {
        await cleanupDedupedOrphans(local, reconciled);
      }
      return reconciled;
    }

    if (merged.length < local.length) {
      await cleanupDedupedOrphans(local, merged);
    }
    return merged;
  } catch {
    return dedupeConsultations(local);
  }
}

/** Envia apenas rascunhos pendentes ao servidor (debounce). Edições usam sync imediato por registro. */
export function scheduleSyncConsultasToServer(events: ConsultationRecord[]): void {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);

  const deduped = dedupeConsultations(events);
  syncTimer = setTimeout(() => {
    void syncAllConsultasToServer(deduped);
  }, 800);
}

/** Sobe rascunhos locais antes de puxar do servidor (sync manual). */
export async function flushLocalConsultasToServer(ownerEmail?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  const { loadConsultations } = await import('@/lib/consultations');
  const local = dedupeConsultations(loadConsultations(ownerEmail));
  await syncAllConsultasToServer(local);
}

/** Puxa consultas do Supabase como fonte de verdade, preservando imports Google ainda não persistidos. */
export async function pullConsultasAuthoritativeFromServer(
  local?: ConsultationRecord[],
  ownerEmail?: string | null,
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return [];
  const serverEvents = await fetchServerConsultas();
  let localEvents = local;
  if (localEvents === undefined) {
    const { loadConsultations } = await import('@/lib/consultations');
    localEvents = loadConsultations(ownerEmail);
  }
  return mergeServerPullWithLocal(localEvents, serverEvents);
}
