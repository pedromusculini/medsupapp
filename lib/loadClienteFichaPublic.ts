import { findCliente, loadClientesStore } from '@/lib/clientesDrive';
import { getOwnerDriveAccessToken } from '@/lib/ownerGoogleDrive';
import { isProntuarioObservacao } from '@/lib/prontuarioContent';
import { loadMergedProntuarioEntradasForCliente } from '@/lib/prontuarioEntradasMerge';
import type { ProntuarioEntrada } from '@/lib/prontuarioEntradasDrive';
import { supabaseAdmin } from '@/lib/supabaseClient';

export type ClienteFichaPublicAtendimento = {
  data: string;
  hora: string | null;
  servico: string | null;
  medico: string | null;
  observacoes: string | null;
  status: string;
};

export type ClienteFichaPublicData = {
  nome_clinica: string;
  cliente_drive_id: string;
  cliente: {
    nome: string;
    telefone: string | null;
    email: string | null;
    convenio: string | null;
    observacoes_gerais: string | null;
  };
  observacoes: Array<{ texto: string; autor: string | null; created_at: string }>;
  ultimos_atendimentos: ClienteFichaPublicAtendimento[];
  evolucoes: ProntuarioEntrada[];
};

async function loadClinicDisplayName(ownerEmail: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('clinic_name, full_name')
    .eq('email', ownerEmail)
    .maybeSingle();

  return (
    data?.clinic_name?.trim() ||
    data?.full_name?.trim() ||
    'Clínica'
  );
}

export async function loadClienteFichaByFormularioToken(
  token: string,
): Promise<
  | { ok: true; data: ClienteFichaPublicData }
  | { ok: false; status: number; error: string }
> {
  const { data: link, error } = await supabaseAdmin
    .from('formulario_links')
    .select('titulo, ativo, expires_at, cliente_drive_id, owner_email')
    .eq('token', token)
    .single();

  if (error || !link) {
    return { ok: false, status: 404, error: 'Link inválido ou expirado' };
  }

  if (!link.ativo) {
    return { ok: false, status: 410, error: 'Este link não está mais ativo' };
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { ok: false, status: 410, error: 'Link expirado' };
  }

  const clienteDriveId = String(link.cliente_drive_id ?? '').trim();
  if (!clienteDriveId) {
    return {
      ok: false,
      status: 400,
      error: 'Este link é de cadastro geral, não de ficha de paciente',
    };
  }

  const ownerEmail = String(link.owner_email ?? '').trim().toLowerCase();
  const driveToken = await getOwnerDriveAccessToken(ownerEmail);
  if (!driveToken) {
    return { ok: false, status: 503, error: 'Não foi possível acessar os dados do paciente' };
  }

  const store = await loadClientesStore(driveToken, ownerEmail);
  const cliente = findCliente(store, clienteDriveId);
  if (!cliente) {
    return { ok: false, status: 404, error: 'Paciente não encontrado' };
  }

  const [nomeClinica, evolucoes] = await Promise.all([
    loadClinicDisplayName(ownerEmail),
    loadMergedProntuarioEntradasForCliente({
      clinicaEmail: ownerEmail,
      clienteDriveId,
      limit: 20,
    }),
  ]);

  const atendimentos = [...cliente.atendimentos]
    .sort((a, b) => {
      const da = `${a.data}T${a.hora ?? '00:00'}`;
      const db = `${b.data}T${b.hora ?? '00:00'}`;
      return db.localeCompare(da);
    })
    .slice(0, 5)
    .map((a) => ({
      data: a.data,
      hora: a.hora,
      servico: a.tipo,
      medico: a.medico,
      observacoes: a.observacoes,
      status: a.status,
    }));

  const observacoes = (cliente.observacoes ?? [])
    .filter((o) => !isProntuarioObservacao(o.texto))
    .map((o) => ({
      texto: o.texto,
      autor: o.autor,
      created_at: o.created_at,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    ok: true,
    data: {
      nome_clinica: nomeClinica,
      cliente_drive_id: clienteDriveId,
      cliente: {
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        convenio: cliente.convenio,
        observacoes_gerais: null,
      },
      observacoes,
      ultimos_atendimentos: atendimentos,
      evolucoes,
    },
  };
}
