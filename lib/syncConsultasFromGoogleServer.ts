import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  getProfissionalAccessToken,
  listConnectedProfissionalIds,
} from '@/lib/profissionalGoogleCalendar';
import {
  resolveGoogleSubByOwnerEmail,
} from '@/lib/publicAgendamentoCalendar';
import { getOwnerGoogleAccessToken } from '@/lib/ownerGoogleTokens';
import {
  upsertConsultasAgenda,
  type ConsultaAgendaRow,
  type ConsultaSyncInput,
} from '@/lib/consultasAgenda';
import type { ConsultaStatus } from '@/lib/consultations';
import { normalizePhoneDigits } from '@/lib/phone';

type CalendarAuth = {
  accessToken: string;
  calendarId: string;
};

type GoogleEventItem = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type ParsedGoogleConsulta = {
  googleEventId: string;
  googleProfissionalId: string | null;
  paciente: string;
  servico: string;
  telefone: string | null;
  inicio: string;
  fim: string | null;
  local: string | null;
  medico: string | null;
};

function calendarEventsUrl(calendarId: string): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
}

async function fetchCalendarEvents(
  authCtx: CalendarAuth,
  params: URLSearchParams,
): Promise<GoogleEventItem[]> {
  const res = await fetch(`${calendarEventsUrl(authCtx.calendarId)}?${params}`, {
    headers: {
      Authorization: `Bearer ${authCtx.accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      (error as { error?: { message?: string } })?.error?.message ||
        'Erro ao acessar Google Calendar',
    );
  }

  const data = (await res.json()) as { items?: GoogleEventItem[] };
  return data.items ?? [];
}

function parseTelefoneFromDescription(description: string | undefined): string | null {
  if (!description) return null;
  const match =
    description.match(/(?:Tel|Telefone|WhatsApp)\s*:\s*([+\d()\s-]{8,})/i) ??
    description.match(/(?:Tel|Telefone|WhatsApp)\s*:\s*(\S+)/i);
  if (!match?.[1]) return null;
  const digits = normalizePhoneDigits(match[1].trim());
  return digits ?? null;
}

function parsePacienteFromSummary(summary: string | undefined): { paciente: string; servico: string } {
  const raw = (summary ?? '').trim() || 'Consulta';
  const parts = raw.split(/\s*[—–-]\s+/);
  if (parts.length >= 2) {
    return {
      servico: parts[0].trim() || 'Consulta',
      paciente: parts.slice(1).join(' - ').trim() || raw,
    };
  }
  return { servico: 'Consulta', paciente: raw };
}

function parseGoogleEventItem(
  item: GoogleEventItem,
  medico: string | null,
  googleProfissionalId: string | null,
): ParsedGoogleConsulta | null {
  if (!item.id) return null;
  const inicio = item.start?.dateTime ?? item.start?.date;
  if (!inicio) return null;

  const { paciente, servico } = parsePacienteFromSummary(item.summary);
  const telefone = parseTelefoneFromDescription(item.description);
  const fim = item.end?.dateTime ?? item.end?.date ?? null;

  return {
    googleEventId: item.id,
    googleProfissionalId,
    paciente,
    servico,
    telefone,
    inicio: typeof inicio === 'string' ? inicio : new Date(inicio).toISOString(),
    fim: fim ? (typeof fim === 'string' ? fim : new Date(fim).toISOString()) : null,
    local: item.location?.trim() || null,
    medico,
  };
}

async function fetchEventsForAuth(
  authCtx: CalendarAuth,
  medico: string | null,
  googleProfissionalId: string | null,
  timeMin: string,
  timeMax: string,
): Promise<ParsedGoogleConsulta[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: '250',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const items = await fetchCalendarEvents(authCtx, params);
  const out: ParsedGoogleConsulta[] = [];
  for (const item of items) {
    const parsed = parseGoogleEventItem(item, medico, googleProfissionalId);
    if (parsed) out.push(parsed);
  }
  return out;
}

async function fetchAllGoogleCalendarConsultas(
  ownerEmail: string,
  timeMin: string,
  timeMax: string,
): Promise<ParsedGoogleConsulta[]> {
  const owner = ownerEmail.toLowerCase().trim();
  const seen = new Set<string>();
  const all: ParsedGoogleConsulta[] = [];

  const connectedIds = await listConnectedProfissionalIds(owner);
  for (const profId of connectedIds) {
    const authCtx = await getProfissionalAccessToken(profId, owner);
    if (!authCtx) continue;

    const { data: medicoRow } = await supabaseAdmin
      .from('clinica_medicos')
      .select('nome')
      .eq('id', profId)
      .maybeSingle();

    try {
      const events = await fetchEventsForAuth(
        authCtx,
        medicoRow?.nome ? String(medicoRow.nome) : null,
        profId,
        timeMin,
        timeMax,
      );
      for (const ev of events) {
        const key = `${profId}:${ev.googleEventId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(ev);
      }
    } catch (err) {
      console.warn(`[syncConsultasFromGoogle] médico ${profId}:`, err);
    }
  }

  const googleSub = await resolveGoogleSubByOwnerEmail(owner);
  if (googleSub) {
    const accessToken = await getOwnerGoogleAccessToken(googleSub, 'calendar');
    if (accessToken) {
      try {
        const events = await fetchEventsForAuth(
          { accessToken, calendarId: 'primary' },
          null,
          null,
          timeMin,
          timeMax,
        );
        for (const ev of events) {
          const key = `titular:${ev.googleEventId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          all.push(ev);
        }
      } catch (err) {
        console.warn('[syncConsultasFromGoogle] titular:', err);
      }
    }
  }

  return all;
}

/** Sincroniza consultas_agenda a partir do Google Calendar (titular + equipe). */
export async function syncConsultasAgendaFromGoogleCalendars(
  ownerEmail: string,
): Promise<{ upserted: number }> {
  const owner = ownerEmail.toLowerCase().trim();
  const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();

  const googleEvents = await fetchAllGoogleCalendarConsultas(owner, timeMin, timeMax);
  if (googleEvents.length === 0) return { upserted: 0 };

  const { loadExcludedGoogleEventIds } = await import('@/lib/consultasAgendaExcluidos');
  const excluded = await loadExcludedGoogleEventIds(owner);
  const activeEvents = googleEvents.filter(
    (ev) => !excluded.has(String(ev.googleEventId)),
  );
  if (activeEvents.length === 0) return { upserted: 0 };

  const { data: existingRows, error } = await supabaseAdmin
    .from('consultas_agenda')
    .select('*')
    .eq('owner_email', owner)
    .gte('inicio', timeMin)
    .lte('inicio', timeMax);

  if (error) throw error;

  const byGoogleId = new Map<string, ConsultaAgendaRow>();
  for (const row of (existingRows ?? []) as ConsultaAgendaRow[]) {
    if (row.google_event_id) byGoogleId.set(row.google_event_id, row);
  }

  const consultas: ConsultaSyncInput[] = activeEvents.map((ev) => {
    const existing = byGoogleId.get(ev.googleEventId);
    let servico = ev.servico;
    // Save recente no Supabase vence pull Google (protege edição só de serviço).
    if (existing?.servico?.trim() && existing.updated_at) {
      const ageMs = Date.now() - new Date(existing.updated_at).getTime();
      if (ageMs >= 0 && ageMs < 2 * 60 * 1000) {
        servico = existing.servico;
      }
    }
    return {
      id: existing?.id ?? `google-${ev.googleEventId}`,
      paciente: ev.paciente,
      servico,
      telefone: existing?.telefone ?? ev.telefone,
      inicio: ev.inicio,
      fim: ev.fim,
      local: ev.local ?? existing?.local ?? null,
      google_event_id: ev.googleEventId,
      google_profissional_id: ev.googleProfissionalId,
      medico: ev.medico ?? existing?.medico ?? null,
      convenio: existing?.convenio ?? null,
      status: (existing?.status as ConsultaStatus | undefined) ?? 'agendado',
      lembretes_whatsapp: existing?.lembretes_whatsapp ?? true,
      cliente_drive_id: existing?.cliente_drive_id ?? null,
      tipo_consulta: existing?.tipo_consulta ?? null,
    };
  });

  return upsertConsultasAgenda(owner, consultas);
}
