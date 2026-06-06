import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';

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

export async function searchPacientesClinica(
  clinicaEmail: string,
  query: string,
  limit = 20,
) {
  const owner = clinicaEmail.toLowerCase().trim();
  const q = query.trim();
  if (q.length < 2) return [];

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
  return data ?? [];
}

export async function listProntuarioEntradas(params: {
  clinicaEmail: string;
  clienteDriveId?: string | null;
  medicoId?: string | null;
  limit?: number;
}) {
  const owner = params.clinicaEmail.toLowerCase().trim();
  let q = supabaseAdmin
    .from('prontuario_entradas')
    .select('id, texto, autor_nome, paciente_nome, created_at, cliente_drive_id')
    .eq('clinica_email', owner)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50);

  if (params.clienteDriveId) {
    q = q.eq('cliente_drive_id', params.clienteDriveId);
  }
  if (params.medicoId) {
    q = q.eq('clinica_medicos_id', params.medicoId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
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
