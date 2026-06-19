import type { ConsultationRecord, ConsultaStatus } from '@/lib/consultations';
import { parseEventDate } from '@/lib/consultations';

const fetchOpts = { cache: 'no-store' as RequestCache };

type ServerConsultaRow = {
  id: string;
  status?: string;
  telefone?: string | null;
  lembretes_whatsapp?: boolean;
};

export function consultationToSyncPayload(ev: ConsultationRecord) {
  const start = parseEventDate(ev.start);
  const end = parseEventDate(ev.end);
  if (!start || !ev.id) return null;
  return {
    id: String(ev.id),
    patient: ev.patient ?? '',
    service: ev.service,
    telefone: ev.telefone ?? null,
    start: start.toISOString(),
    end: end?.toISOString() ?? null,
    location: ev.location,
    googleEventId: ev.googleEventId,
    medico: ev.medico,
    convenio: ev.convenio,
    status: ev.status ?? 'agendado',
    lembretesWhatsapp: ev.lembretesWhatsapp !== false,
    clienteDriveId: ev.clienteDriveId ?? null,
    tipoConsulta: ev.tipoConsulta ?? null,
  };
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

async function postConsultasSync(
  consultas: NonNullable<ReturnType<typeof consultationToSyncPayload>>[],
): Promise<void> {
  if (consultas.length === 0) return;
  await fetch('/api/consultas/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consultas }),
  }).catch(() => {
    /* sync best-effort */
  });
}

/** Sincroniza uma consulta imediatamente (ex.: link calendário no WhatsApp pós-agendar). */
export async function syncConsultaToServerImmediately(
  ev: ConsultationRecord,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const payload = consultationToSyncPayload(ev);
  if (!payload) return;
  await postConsultasSync([payload]);
}

/** Atualiza grade a partir do servidor (focus/visibility) — não envia localStorage. */
export async function refreshConsultasFromServer(
  local: ConsultationRecord[],
): Promise<ConsultationRecord[]> {
  if (typeof window === 'undefined') return local;

  try {
    const res = await fetch('/api/consultas', fetchOpts);
    if (!res.ok) return local;
    const data = (await res.json()) as { consultas?: ServerConsultaRow[] };
    const rows = data.consultas;
    if (!rows?.length) return local;

    const byId = new Map(rows.map((r) => [String(r.id), r]));
    return local.map((ev) => {
      const row = byId.get(String(ev.id));
      if (!row) return ev;
      return {
        ...ev,
        status: (row.status as ConsultaStatus) ?? ev.status,
        telefone: row.telefone ?? ev.telefone,
        lembretesWhatsapp:
          row.lembretes_whatsapp === false ? false : ev.lembretesWhatsapp,
      };
    });
  } catch {
    return local;
  }
}

/** Envia consultas futuras ao servidor (debounce) para lembretes D-7/D-1. */
export function scheduleSyncConsultasToServer(events: ConsultationRecord[]): void {
  if (typeof window === 'undefined') return;
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(() => {
    const now = Date.now();
    const consultas = events
      .map(consultationToSyncPayload)
      .filter((c): c is NonNullable<typeof c> => {
        if (!c) return false;
        const t = new Date(c.start).getTime();
        return t > now - 24 * 60 * 60 * 1000;
      });

    void postConsultasSync(consultas);
  }, 800);
}
