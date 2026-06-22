import { randomUUID } from 'crypto';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ATENDIMENTO_LABEL } from '@/lib/constants';
import {
  findCliente,
  findClienteByContato,
  loadClientesStore,
  type ClienteDriveRecord,
} from '@/lib/clientesDrive';
import { getOwnerDriveAccessToken } from '@/lib/ownerGoogleDrive';
import { phonesMatch } from '@/lib/phoneMatch';
import { isProntuarioObservacao } from '@/lib/prontuarioContent';
import { loadMergedProntuarioEntradas } from '@/lib/prontuarioEntradasMerge';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { normalizePhoneDigits, normalizePhoneForStorage } from '@/lib/phone';

export type MedicoProntuarioAcesso = {
  id: string;
  clinica_medicos_id: string;
  access_token: string;
};

export function buildProntuarioPath(token: string): string {
  return `/prontuario/${token}`;
}

export function buildProntuarioUrl(token: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base}${buildProntuarioPath(token)}`;
}

export async function ensureMedicoProntuarioAcesso(
  clinicaMedicosId: string,
): Promise<MedicoProntuarioAcesso> {
  const { data: existing } = await supabaseAdmin
    .from('medico_prontuario_acesso')
    .select('*')
    .eq('clinica_medicos_id', clinicaMedicosId)
    .maybeSingle();

  if (existing) return existing as MedicoProntuarioAcesso;

  const { data, error } = await supabaseAdmin
    .from('medico_prontuario_acesso')
    .insert({
      clinica_medicos_id: clinicaMedicosId,
      access_token: randomUUID(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as MedicoProntuarioAcesso;
}

export async function getMedicoByProntuarioToken(token: string) {
  const { data: row, error } = await supabaseAdmin
    .from('medico_prontuario_acesso')
    .select('*')
    .eq('access_token', token.trim())
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const { data: medico, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome, clinica_email, specialty, crm')
    .eq('id', row.clinica_medicos_id)
    .maybeSingle();

  if (medErr) throw medErr;
  if (!medico) return null;

  const { data: profile } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('clinic_name, full_name')
    .eq('email', medico.clinica_email)
    .maybeSingle();

  const nomeClinica =
    profile?.clinic_name?.trim() || profile?.full_name?.trim() || 'Clínica';

  return {
    medicoId: medico.id as string,
    nomeMedico: medico.nome as string,
    clinicaEmail: medico.clinica_email as string,
    nomeClinica,
    specialty: medico.specialty as string | null,
    crm: medico.crm as string | null,
  };
}

export type PacienteProntuarioOpcao = {
  nome: string;
  telefone_normalizado: string | null;
  cliente_drive_id: string | null;
  convenio?: string | null;
};

function pacienteOpcaoKey(p: PacienteProntuarioOpcao): string {
  if (p.cliente_drive_id) return `drive:${p.cliente_drive_id}`;
  const tel = p.telefone_normalizado ?? '';
  return `nome:${p.nome.toLowerCase()}|tel:${tel}`;
}

function mergePacienteOpcoes(
  target: Map<string, PacienteProntuarioOpcao>,
  list: PacienteProntuarioOpcao[],
) {
  for (const p of list) {
    const key = pacienteOpcaoKey(p);
    const existing = target.get(key);
    if (!existing) {
      target.set(key, p);
      continue;
    }
    if (!existing.cliente_drive_id && p.cliente_drive_id) {
      target.set(key, { ...existing, cliente_drive_id: p.cliente_drive_id });
    }
    if (!existing.convenio && p.convenio) {
      target.set(key, { ...existing, convenio: p.convenio });
    }
  }
}

function clienteDriveToOpcao(c: ClienteDriveRecord): PacienteProntuarioOpcao {
  return {
    nome: c.nome,
    telefone_normalizado: c.telefone ? normalizePhoneDigits(c.telefone) : null,
    cliente_drive_id: c.id,
    convenio: c.convenio,
  };
}

function matchesPacienteQuery(
  nome: string,
  telefone: string | null | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  if (nome.toLowerCase().includes(q)) return true;
  if (digits.length >= 4 && telefone) {
    const tel = telefone.replace(/\D/g, '');
    if (tel.includes(digits)) return true;
    if (phonesMatch(telefone, digits)) return true;
  }
  return false;
}

async function searchPacientesIndex(
  owner: string,
  query: string,
  limit: number,
): Promise<PacienteProntuarioOpcao[]> {
  const q = query.trim();
  const digits = q.replace(/\D/g, '');
  let dbQuery = supabaseAdmin
    .from('pacientes_index')
    .select('nome, telefone_normalizado, cliente_drive_id, convenio')
    .eq('owner_email', owner)
    .limit(limit);

  if (digits.length >= 4) {
    dbQuery = dbQuery.ilike('telefone_normalizado', `%${digits}%`);
  } else {
    dbQuery = dbQuery.ilike('nome', `%${q}%`);
  }

  const { data, error } = await dbQuery;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    nome: row.nome as string,
    telefone_normalizado: (row.telefone_normalizado as string) ?? null,
    cliente_drive_id: (row.cliente_drive_id as string) ?? null,
    convenio: (row.convenio as string) ?? null,
  }));
}

async function searchPacientesDrive(
  owner: string,
  query: string,
  limit: number,
): Promise<PacienteProntuarioOpcao[]> {
  const token = await getOwnerDriveAccessToken(owner);
  if (!token) return [];

  try {
    const store = await loadClientesStore(token, owner);

    const matched = store.clientes.filter((c) =>
      matchesPacienteQuery(c.nome, c.telefone, query),
    );

    return matched
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, limit)
      .map(clienteDriveToOpcao);
  } catch (err) {
    console.error('[medicoProntuario] busca Drive:', err);
    return [];
  }
}

async function searchPacientesProntuario(
  owner: string,
  query: string,
  limit: number,
): Promise<PacienteProntuarioOpcao[]> {
  const { data, error } = await supabaseAdmin
    .from('prontuario_entradas')
    .select('paciente_nome, telefone, cliente_drive_id')
    .eq('clinica_email', owner)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw error;

  const seen = new Set<string>();
  const out: PacienteProntuarioOpcao[] = [];

  for (const row of data ?? []) {
    const nome = String(row.paciente_nome ?? '').trim();
    if (!nome) continue;
    const telefone = row.telefone ? normalizePhoneDigits(String(row.telefone)) : null;
    if (!matchesPacienteQuery(nome, telefone, query)) continue;

    const key = `${nome.toLowerCase()}|${telefone ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      nome,
      telefone_normalizado: telefone,
      cliente_drive_id: (row.cliente_drive_id as string) ?? null,
      convenio: null,
    });
    if (out.length >= limit) break;
  }

  return out;
}

/** Busca pacientes no índice, Google Drive e registros anteriores de prontuário. */
export async function searchPacientesClinica(
  clinicaEmail: string,
  query: string,
  limit = 20,
): Promise<PacienteProntuarioOpcao[]> {
  const owner = clinicaEmail.toLowerCase().trim();
  const q = query.trim();
  if (q.length < 2) return [];

  const merged = new Map<string, PacienteProntuarioOpcao>();

  const [indexRows, driveRows, prontuarioRows] = await Promise.all([
    searchPacientesIndex(owner, q, limit),
    searchPacientesDrive(owner, q, limit),
    searchPacientesProntuario(owner, q, limit),
  ]);

  mergePacienteOpcoes(merged, indexRows);
  mergePacienteOpcoes(merged, driveRows);
  mergePacienteOpcoes(merged, prontuarioRows);

  return [...merged.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limit);
}

export type HistoricoClinicoItem = {
  id: string;
  tipo: 'prontuario' | 'consulta' | 'observacao' | 'pagamento';
  tipoLabel: string;
  data: string;
  dataLabel: string;
  observacao: string;
  valorPago: number | null;
  plano: string | null;
  autor: string | null;
};

function formatDataLabel(isoOrDate: string): string {
  try {
    const d = isoOrDate.includes('T')
      ? parseISO(isoOrDate)
      : parseISO(`${isoOrDate}T12:00:00`);
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return isoOrDate;
  }
}

function labelFormaPagamento(id: string | null | undefined): string {
  if (!id) return '';
  return ATENDIMENTO_LABEL[id] ?? id;
}

export async function getPacienteHistoricoClinico(params: {
  clinicaEmail: string;
  clienteDriveId?: string | null;
  pacienteNome?: string | null;
  telefone?: string | null;
  limit?: number;
}): Promise<{
  paciente: { nome: string; convenio: string | null; telefone: string | null };
  itens: HistoricoClinicoItem[];
}> {
  const owner = params.clinicaEmail.toLowerCase().trim();
  const limit = params.limit ?? 5;
  const nome = params.pacienteNome?.trim() ?? '';
  const telefoneNorm = params.telefone
    ? normalizePhoneDigits(params.telefone)
    : null;

  const itens: HistoricoClinicoItem[] = [];
  let convenio: string | null = null;
  let telefoneExib = telefoneNorm;
  let nomePaciente = nome;

  const token = await getOwnerDriveAccessToken(owner);
  if (token) {
    try {
      const store = await loadClientesStore(token, owner);
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
      if (cliente) {
        nomePaciente = cliente.nome || nomePaciente;
        convenio = cliente.convenio;
        telefoneExib = cliente.telefone
          ? normalizePhoneDigits(cliente.telefone)
          : telefoneExib;
        for (const a of cliente.atendimentos) {
          const pag = cliente.pagamentos.find((p) => p.atendimento_id === a.id);
          const valor = pag?.valor ?? a.valor ?? null;
          const plano = a.plano?.trim() || cliente.convenio || null;
          const obs = a.observacoes?.trim() || null;
          const tipoLabel = ATENDIMENTO_LABEL[a.tipo] ?? a.tipo;
          const texto =
            obs ||
            `${tipoLabel}${a.medico ? ` — ${a.medico}` : ''}${a.hora ? ` às ${a.hora.slice(0, 5)}` : ''}`;

          itens.push({
            id: `atend:${a.id}`,
            tipo: 'consulta',
            tipoLabel: tipoLabel,
            data: a.created_at || `${a.data}T12:00:00`,
            dataLabel: a.hora
              ? `${format(parseISO(`${a.data}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR })} às ${a.hora.slice(0, 5)}`
              : format(parseISO(`${a.data}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR }),
            observacao: texto,
            valorPago: valor,
            plano,
            autor: a.medico,
          });
        }

        for (const o of cliente.observacoes) {
          if (isProntuarioObservacao(o.texto)) continue;
          itens.push({
            id: `obs:${o.id}`,
            tipo: 'observacao',
            tipoLabel: 'Observação',
            data: o.created_at,
            dataLabel: formatDataLabel(o.created_at),
            observacao: o.texto,
            valorPago: null,
            plano: cliente.convenio,
            autor: o.autor,
          });
        }

        for (const p of cliente.pagamentos) {
          if (cliente.atendimentos.some((a) => a.id === p.atendimento_id)) continue;
          itens.push({
            id: `pag:${p.id}`,
            tipo: 'pagamento',
            tipoLabel: 'Pagamento',
            data: p.created_at || `${p.data}T12:00:00`,
            dataLabel: format(parseISO(`${p.data}T12:00:00`), 'dd/MM/yyyy', {
              locale: ptBR,
            }),
            observacao:
              p.observacao?.trim() ||
              labelFormaPagamento(p.forma_pagamento) ||
              'Pagamento registrado',
            valorPago: p.valor,
            plano: cliente.convenio,
            autor: null,
          });
        }

      }
    } catch (err) {
      console.error('[medicoProntuario] histórico Drive:', err);
    }
  }

  const prontuarioUnificado = await loadMergedProntuarioEntradas({
    clinicaEmail: owner,
    clienteDriveId: params.clienteDriveId,
    pacienteNome: params.pacienteNome,
    telefone: params.telefone,
    limit: 30,
  });
  for (const e of prontuarioUnificado) {
    if (!nomePaciente && e.paciente_nome) nomePaciente = e.paciente_nome;
    itens.push({
      id: `pront:${e.id}`,
      tipo: 'prontuario',
      tipoLabel: 'Prontuário',
      data: e.created_at,
      dataLabel: formatDataLabel(e.created_at),
      observacao: e.texto,
      valorPago: null,
      plano: convenio,
      autor: e.autor_nome,
    });
  }

  const sorted = itens
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, limit);

  return {
    paciente: {
      nome: nomePaciente || 'Paciente',
      convenio,
      telefone: telefoneExib,
    },
    itens: sorted,
  };
}

export async function listProntuarioEntradas(params: {
  clinicaEmail: string;
  clienteDriveId?: string | null;
  pacienteNome?: string | null;
  telefone?: string | null;
  medicoId?: string | null;
  limit?: number;
}) {
  const merged = await loadMergedProntuarioEntradas(params);
  return merged.map((e) => ({
    id: e.id,
    texto: e.texto,
    autor_nome: e.autor_nome,
    paciente_nome: e.paciente_nome ?? null,
    created_at: e.created_at,
    cliente_drive_id: e.cliente_drive_id ?? null,
  }));
}

export async function addProntuarioEntrada(params: {
  clinicaEmail: string;
  medicoId: string;
  autorNome: string;
  pacienteNome: string;
  telefone?: string | null;
  clienteDriveId?: string | null;
  texto: string;
}) {
  const { data, error } = await supabaseAdmin
    .from('prontuario_entradas')
    .insert({
      clinica_email: params.clinicaEmail.toLowerCase().trim(),
      clinica_medicos_id: params.medicoId,
      cliente_drive_id: params.clienteDriveId ?? null,
      paciente_nome: params.pacienteNome.trim(),
      telefone: params.telefone ?? null,
      texto: params.texto.trim(),
      autor_nome: params.autorNome.trim(),
    })
    .select('id, created_at')
    .single();

  if (error) throw error;
  return data;
}
