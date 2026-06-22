import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  consultaLogicalKey,
  pickBetterConsultaRowForLembretes,
  queryConsultasAgendaForDay,
  addDaysToKey,
  brTodayKey,
  type ConsultaAgendaRow,
  type LembreteTipo,
} from '@/lib/consultasAgenda';
import { enderecoVarsFromProfile, loadOwnerProfile } from '@/lib/agendamento';
import { getConsultaCalendarLinksMap } from '@/lib/calendarToken';
import { getLembretesSettings, type LembretesWhatsappSettings } from '@/lib/lembretesSettings';
import {
  formatConsultaDataHora,
  getMensagensConfig,
  renderMensagem,
  type MensagemTipo,
} from '@/lib/mensagensWhatsapp';
import { buildWhatsAppUrls } from '@/lib/whatsapp';
import { syncConsultasAgendaFromGoogleCalendars } from '@/lib/syncConsultasFromGoogleServer';

export type LembretePendenteItem = ConsultaAgendaRow & {
  data: string;
  hora: string;
  mensagem: string;
  whatsapp_url: string | null;
  whatsapp_app_url: string | null;
  whatsapp_android_url: string | null;
};

export type LembretesPendentesResponse = {
  lembretes7: LembretePendenteItem[];
  lembretes1: LembretePendenteItem[];
  lembretesSettings: LembretesWhatsappSettings;
};

type PacienteIndexMaps = {
  byDriveId: Map<string, string>;
  byNome: Map<string, string>;
};

function groupByLogicalKey(rows: ConsultaAgendaRow[]) {
  const groups = new Map<string, ConsultaAgendaRow[]>();
  for (const row of rows) {
    const key = consultaLogicalKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return groups;
}

async function loadPacienteIndexMaps(owner: string): Promise<PacienteIndexMaps> {
  const { data, error } = await supabaseAdmin
    .from('pacientes_index')
    .select('telefone_normalizado, nome, cliente_drive_id')
    .eq('owner_email', owner);

  if (error && error.code !== 'PGRST205') throw error;

  const byDriveId = new Map<string, string>();
  const byNome = new Map<string, string>();

  for (const row of data ?? []) {
    const tel = row.telefone_normalizado ? String(row.telefone_normalizado) : '';
    if (!tel) continue;
    if (row.cliente_drive_id) byDriveId.set(String(row.cliente_drive_id), tel);
    const nomeKey = String(row.nome ?? '')
      .trim()
      .toLowerCase();
    if (nomeKey && !byNome.has(nomeKey)) byNome.set(nomeKey, tel);
  }

  return { byDriveId, byNome };
}

function resolveTelefone(
  row: ConsultaAgendaRow,
  maps: PacienteIndexMaps,
): string | null {
  if (row.telefone?.trim()) return row.telefone.trim();
  if (row.cliente_drive_id && maps.byDriveId.has(row.cliente_drive_id)) {
    return maps.byDriveId.get(row.cliente_drive_id)!;
  }
  const nomeKey = row.paciente.trim().toLowerCase();
  return maps.byNome.get(nomeKey) ?? null;
}

async function loadLembreteHiddenSet(consultaIds: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (consultaIds.length === 0) return set;

  const [enviadoRes, dispensadoRes] = await Promise.all([
    supabaseAdmin
      .from('whatsapp_lembrete_enviado')
      .select('consulta_id, lembrete_tipo')
      .in('consulta_id', consultaIds),
    supabaseAdmin
      .from('whatsapp_lembrete_dispensado')
      .select('consulta_id, lembrete_tipo')
      .in('consulta_id', consultaIds),
  ]);

  if (enviadoRes.error && enviadoRes.error.code !== 'PGRST205') throw enviadoRes.error;
  if (dispensadoRes.error && dispensadoRes.error.code !== 'PGRST205') throw dispensadoRes.error;

  for (const row of enviadoRes.data ?? []) {
    set.add(`${row.consulta_id}:${row.lembrete_tipo}`);
  }
  for (const row of dispensadoRes.data ?? []) {
    set.add(`${row.consulta_id}:${row.lembrete_tipo}`);
  }

  return set;
}

function isHiddenForTipo(
  siblingIds: string[],
  tipo: LembreteTipo,
  hiddenSet: Set<string>,
): boolean {
  for (const id of siblingIds) {
    if (hiddenSet.has(`${id}:${tipo}`)) return true;
  }
  return false;
}

function filterConsultasForLembrete(
  rows: ConsultaAgendaRow[],
  tipo: LembreteTipo,
  hiddenSet: Set<string>,
  maps: PacienteIndexMaps,
): ConsultaAgendaRow[] {
  const groups = groupByLogicalKey(rows);
  const filtered: ConsultaAgendaRow[] = [];

  for (const [, siblings] of groups) {
    let display = siblings[0];
    for (const s of siblings.slice(1)) {
      display = pickBetterConsultaRowForLembretes(display, s);
    }
    const siblingIds = siblings.map((s) => s.id);
    if (isHiddenForTipo(siblingIds, tipo, hiddenSet)) continue;

    const telefone = resolveTelefone(display, maps);
    if (!telefone) continue;

    filtered.push({ ...display, telefone });
  }

  return filtered.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function enrichItems(
  list: ConsultaAgendaRow[],
  tipo: MensagemTipo,
  params: {
    clinica: string;
    localPerfil: string;
    linkMaps: string;
    calendarLinks: Map<string, string>;
    mensagensConfig: Awaited<ReturnType<typeof getMensagensConfig>>;
    lembretesSettings: LembretesWhatsappSettings;
  },
): LembretePendenteItem[] {
  const template = params.mensagensConfig[tipo];

  return list.map((c) => {
    const { data, hora } = formatConsultaDataHora(c.inicio);
    const linkCal = params.calendarLinks.get(c.id) ?? '';
    const mensagem = renderMensagem(template, {
      nome: c.paciente,
      data,
      hora,
      medico: c.medico || '',
      local: c.local || params.localPerfil,
      clinica: params.clinica,
      link_calendario: linkCal,
      link_maps: params.linkMaps,
      ...(tipo === 'lembrete_7_dias'
        ? { dias: String(params.lembretesSettings.lembrete_antecedencia_dias) }
        : {}),
    });
    const urls = c.telefone ? buildWhatsAppUrls(c.telefone, mensagem) : null;
    return {
      ...c,
      data,
      hora,
      mensagem,
      whatsapp_url: urls?.web ?? null,
      whatsapp_app_url: urls?.app ?? null,
      whatsapp_android_url: urls?.android ?? null,
    };
  });
}

export async function buildLembretesPendentesResponse(
  ownerEmail: string,
  options?: { syncGoogle?: boolean },
): Promise<LembretesPendentesResponse> {
  const owner = ownerEmail.toLowerCase().trim();

  if (options?.syncGoogle) {
    try {
      await syncConsultasAgendaFromGoogleCalendars(owner);
    } catch (err) {
      console.warn('[lembretesPendentes] sync Google Calendar:', err);
    }
  }

  const lembretesSettings = await getLembretesSettings(owner);
  const today = brTodayKey();

  const targetD7 = lembretesSettings.lembrete_antecedencia_ativo
    ? addDaysToKey(today, lembretesSettings.lembrete_antecedencia_dias)
    : null;
  const targetD1 = lembretesSettings.lembrete_1_dia_ativo ? addDaysToKey(today, 1) : null;

  const [rowsD7, rowsD1, pacienteMaps, profile, mensagensConfig] = await Promise.all([
    targetD7 ? queryConsultasAgendaForDay(owner, targetD7) : Promise.resolve([]),
    targetD1 ? queryConsultasAgendaForDay(owner, targetD1) : Promise.resolve([]),
    loadPacienteIndexMaps(owner),
    loadOwnerProfile(owner),
    getMensagensConfig(owner),
  ]);

  const allIds = [...rowsD7, ...rowsD1].map((r) => r.id);
  const hiddenSet = await loadLembreteHiddenSet(allIds);

  const d7 = targetD7
    ? filterConsultasForLembrete(rowsD7, 'd7', hiddenSet, pacienteMaps)
    : [];
  const d1 = targetD1
    ? filterConsultasForLembrete(rowsD1, 'd1', hiddenSet, pacienteMaps)
    : [];

  const clinica =
    String(profile?.clinic_name ?? profile?.full_name ?? '').trim() || 'sua clínica';
  const { local: localPerfil, link_maps } = enderecoVarsFromProfile(profile);

  const calendarLinks = await getConsultaCalendarLinksMap(
    [...d7, ...d1].map((c) => c.id),
    owner,
  );

  const enrichParams = {
    clinica,
    localPerfil,
    linkMaps: link_maps,
    calendarLinks,
    mensagensConfig,
    lembretesSettings,
  };

  return {
    lembretes7: enrichItems(d7, 'lembrete_7_dias', enrichParams),
    lembretes1: enrichItems(d1, 'lembrete_1_dia', enrichParams),
    lembretesSettings,
  };
}
