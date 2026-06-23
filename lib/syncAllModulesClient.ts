/**
 * Sincronização explícita entre dispositivos (mesmo login).
 * Supabase é fonte de verdade na sync manual.
 */
import { saveConsultations } from '@/lib/consultations';
import type { ConsultationRecord } from '@/lib/consultations';
import {
  flushLocalConsultasToServer,
  pullConsultasAuthoritativeFromServer,
} from '@/lib/syncConsultasClient';

export type SyncAllModulesResult = {
  consultas: number;
  agendamentosClientes?: number;
};

/** Aplica consultas authoritative + retorna contagem (para Agenda). */
export async function syncAgendaAuthoritative(
  _ownerEmail: string,
): Promise<{ events: ConsultationRecord[]; meta: SyncAllModulesResult }> {
  await flushLocalConsultasToServer();
  const events = await pullConsultasAuthoritativeFromServer();
  saveConsultations(events, { broadcast: false });

  let agendamentosClientes: number | undefined;
  try {
    const res = await fetch('/api/clientes/sync-agendamentos', {
      method: 'POST',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { sincronizados?: number };
      agendamentosClientes = data.sincronizados;
    }
  } catch {
    /* opcional */
  }

  return {
    events,
    meta: { consultas: events.length, agendamentosClientes },
  };
}
