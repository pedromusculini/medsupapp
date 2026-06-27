import type { ConsultationRecord } from '@/lib/consultations';
import { fetchWithTimeout, isFetchTimeoutError } from '@/lib/fetchWithTimeout';
import { resolveGoogleCalendarEvent } from '@/lib/googleCalendarResolveClient';

export type PushGoogleCalendarOptions = {
  patient: string;
  start: Date;
  end: Date;
  location?: string;
  medico?: string;
  previousMedico?: string;
  forceCreate?: boolean;
  metadataOnly?: boolean;
  /** Resolve profissional Google id a partir do nome do médico. */
  resolveProfissionalId: (medico?: string) => string | undefined;
};

export type PushGoogleCalendarResult = {
  event: ConsultationRecord;
  error?: string;
  recreated?: boolean;
  transferred?: boolean;
};

function uniqueGooglePatchProfCandidates(
  ...ids: (string | undefined)[]
): (string | undefined)[] {
  const seen = new Set<string>();
  const out: (string | undefined)[] = [];
  for (const id of ids) {
    const key = id ?? '__titular__';
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

/** Cria ou atualiza evento no Google Calendar sem duplicar (PATCH + resolve). */
export async function pushConsultaToGoogleCalendar(
  event: ConsultationRecord,
  opts: PushGoogleCalendarOptions,
): Promise<PushGoogleCalendarResult> {
  const targetProfId = opts.resolveProfissionalId(opts.medico || event.medico);
  const previousGoogleEventId = event.googleEventId
    ? String(event.googleEventId)
    : undefined;
  const previousGoogleProfId = event.googleProfissionalId;

  const serviceLabel = event.service || 'Consulta';
  const summary = `${serviceLabel} - ${opts.patient}`;
  const medicoLabel = opts.medico || event.medico || '';
  const description = [
    `Paciente: ${opts.patient}`,
    `Serviço: ${serviceLabel}`,
    medicoLabel ? `Médico: ${medicoLabel}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const location = opts.location || event.location;

  function buildBody(extra?: { eventId?: string; profissionalId?: string }) {
    return {
      ...(extra?.eventId ? { eventId: extra.eventId } : {}),
      summary,
      description,
      start: opts.start.toISOString(),
      end: opts.end.toISOString(),
      location: location || undefined,
      clienteDriveId: event.clienteDriveId ?? undefined,
      nomeCliente: opts.patient,
      ...(extra?.profissionalId
        ? { profissionalId: extra.profissionalId, medicoId: extra.profissionalId }
        : {}),
    };
  }

  function applyUpdated(
    googleEventId: string,
    googleProfissionalId?: string,
  ): ConsultationRecord {
    return {
      ...event,
      googleEventId,
      googleProfissionalId,
    };
  }

  function profissionalGoogleTargetChanged(): boolean {
    const prev = previousGoogleProfId ?? null;
    const next = targetProfId ?? null;
    return prev !== next;
  }

  async function deleteGoogleEventRobust(
    eventId: string,
    profIds: (string | undefined)[],
  ): Promise<boolean> {
    const tried = new Set<string>();
    for (const profId of profIds) {
      const key = profId ?? '__titular__';
      if (tried.has(key)) continue;
      tried.add(key);
      const params = new URLSearchParams({ eventId });
      if (profId) params.set('profissionalId', profId);
      const res = await fetchWithTimeout(
        `/api/google-calendar?${params.toString()}`,
        { method: 'DELETE' },
      ).catch(() => null);
      if (res?.ok || res?.status === 410) return true;
    }
    return false;
  }

  const previousMedicoProfId = opts.previousMedico
    ? opts.resolveProfissionalId(opts.previousMedico)
    : undefined;

  function deleteCandidates(patchProfId?: string): (string | undefined)[] {
    return [
      previousGoogleProfId,
      previousMedicoProfId,
      patchProfId,
      targetProfId,
      undefined,
    ];
  }

  async function postGoogleEvent(
    profissionalId?: string,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
    const res = await fetchWithTimeout('/api/google-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody({ profissionalId })),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg =
        (err as { error?: string }).error ||
        'Não foi possível criar evento no Google Calendar.';
      return { ok: false, error: msg, status: res.status };
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) {
      return {
        ok: false,
        error: 'Resposta do Google Calendar sem identificador do evento.',
        status: res.status,
      };
    }
    return { ok: true, id: data.id };
  }

  async function patchGoogleEvent(
    eventId: string,
    profissionalId?: string,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
    const res = await fetchWithTimeout('/api/google-calendar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody({ eventId, profissionalId })),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg =
        (err as { error?: string }).error ||
        'Não foi possível atualizar evento no Google Calendar.';
      return { ok: false, error: msg, status: res.status };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id || eventId };
  }

  function isNotFoundOnGoogle(status: number, message: string): boolean {
    if (status === 404 || status === 410) return true;
    return /not found|não encontrado|404/i.test(message);
  }

  async function tryPatchExistingEvent(
    eventId: string,
  ): Promise<{ ok: true; id: string; profId?: string } | { ok: false }> {
    const resolved = await resolveGoogleCalendarEvent(eventId);
    if (!resolved.found) return { ok: false };
    const profId = resolved.profissionalId ?? undefined;
    try {
      const patched = await patchGoogleEvent(eventId, profId);
      if (patched.ok) return { ok: true, id: patched.id, profId };
    } catch {
      /* timeout */
    }
    return { ok: false };
  }

  async function adoptNewGoogleEventSafely(
    previousId: string,
    newId: string,
    profId?: string,
  ): Promise<{ ok: true; event: ConsultationRecord } | { ok: false; error: string }> {
    if (previousId === newId) {
      return { ok: true, event: applyUpdated(newId, profId) };
    }
    const deleted = await deleteGoogleEventRobust(previousId, deleteCandidates(profId));
    if (!deleted) {
      return {
        ok: false,
        error:
          'Novo evento criado no Google, mas o anterior não foi removido. Remova o duplicado manualmente na agenda.',
      };
    }
    return { ok: true, event: applyUpdated(newId, profId) };
  }

  try {
    if (!previousGoogleEventId) {
      const created = await postGoogleEvent(targetProfId);
      if (!created.ok) return { event, error: created.error };
      return { event: applyUpdated(created.id, targetProfId) };
    }

    if (opts.forceCreate) {
      const existing = await tryPatchExistingEvent(previousGoogleEventId);
      if (existing.ok) {
        return { event: applyUpdated(existing.id, existing.profId) };
      }

      const created = await postGoogleEvent(targetProfId);
      if (!created.ok) return { event, error: created.error };

      const adopted = await adoptNewGoogleEventSafely(
        previousGoogleEventId,
        created.id,
        targetProfId,
      );
      if (!adopted.ok) return { event, error: adopted.error };
      return { event: adopted.event, recreated: true };
    }

    if (profissionalGoogleTargetChanged()) {
      const created = await postGoogleEvent(targetProfId);
      if (!created.ok) return { event, error: created.error };

      const adopted = await adoptNewGoogleEventSafely(
        previousGoogleEventId,
        created.id,
        targetProfId,
      );
      if (!adopted.ok) return { event, error: adopted.error };
      return { event: adopted.event, transferred: true };
    }

    const patchCandidates = uniqueGooglePatchProfCandidates(
      previousGoogleProfId,
      previousMedicoProfId,
      targetProfId,
      undefined,
    );

    let lastPatchError = '';
    let lastPatchStatus = 0;
    for (const profId of patchCandidates) {
      let patched: Awaited<ReturnType<typeof patchGoogleEvent>>;
      try {
        patched = await patchGoogleEvent(previousGoogleEventId, profId);
      } catch (patchErr) {
        if (isFetchTimeoutError(patchErr)) {
          const recovered = await tryPatchExistingEvent(previousGoogleEventId);
          if (recovered.ok) {
            return { event: applyUpdated(recovered.id, recovered.profId) };
          }
        }
        throw patchErr;
      }
      if (patched.ok) {
        return { event: applyUpdated(patched.id, profId) };
      }
      lastPatchError = patched.error;
      lastPatchStatus = patched.status;
      if (!isNotFoundOnGoogle(patched.status, patched.error)) {
        const recovered = await tryPatchExistingEvent(previousGoogleEventId);
        if (recovered.ok) {
          return { event: applyUpdated(recovered.id, recovered.profId) };
        }
        return { event, error: patched.error };
      }
    }

    if (opts.metadataOnly) {
      return {
        event,
        error:
          'Consulta salva no sistema. Não foi possível atualizar o Google Calendar' +
          (lastPatchError ? ` (${lastPatchError})` : '') +
          '.',
      };
    }

    if (!isNotFoundOnGoogle(lastPatchStatus, lastPatchError)) {
      const recovered = await tryPatchExistingEvent(previousGoogleEventId);
      if (recovered.ok) {
        return { event: applyUpdated(recovered.id, recovered.profId) };
      }
      return { event, error: lastPatchError };
    }

    const resolvedBeforeCreate = await tryPatchExistingEvent(previousGoogleEventId);
    if (resolvedBeforeCreate.ok) {
      return { event: applyUpdated(resolvedBeforeCreate.id, resolvedBeforeCreate.profId) };
    }

    const created = await postGoogleEvent(targetProfId);
    if (!created.ok) return { event, error: created.error };

    const adopted = await adoptNewGoogleEventSafely(
      previousGoogleEventId,
      created.id,
      targetProfId,
    );
    if (!adopted.ok) return { event, error: adopted.error };
    return { event: adopted.event, recreated: true };
  } catch (err) {
    if (previousGoogleEventId && isFetchTimeoutError(err)) {
      const recovered = await tryPatchExistingEvent(previousGoogleEventId);
      if (recovered.ok) {
        return { event: applyUpdated(recovered.id, recovered.profId) };
      }
    }
    const msg = isFetchTimeoutError(err)
      ? 'Google Calendar demorou demais. A consulta foi salva; tente enviar ao Google depois.'
      : err instanceof Error
        ? err.message
        : 'Falha ao sincronizar com o Google Calendar.';
    return { event, error: msg };
  }
}
