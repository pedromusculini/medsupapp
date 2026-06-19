import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { buildFormularioPublicUrl } from '@/lib/publicFormLinks';
import {
  buildAutocadastroWhatsAppMessage,
  buildFormularioWhatsAppMessage,
  buildWhatsAppUrl,
} from '@/lib/whatsapp';

export type FormularioLinkTipo = 'autocadastro' | 'cliente';

/** Link ativo de cadastro vinculado a um paciente no Drive. */
export async function getActiveClienteFormularioLink(
  ownerEmail: string,
  clienteDriveId: string,
) {
  const { data } = await supabaseAdmin
    .from('formulario_links')
    .select('*')
    .eq('owner_email', ownerEmail)
    .eq('cliente_drive_id', clienteDriveId)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/** Garante link de formulário do paciente (cria se ainda não existir). */
export async function ensureClienteFormularioLink(params: {
  ownerEmail: string;
  clienteDriveId: string;
  nomeCliente?: string;
  nomeClinica?: string;
}) {
  const existing = await getActiveClienteFormularioLink(
    params.ownerEmail,
    params.clienteDriveId,
  );

  if (existing) {
    return {
      token: existing.token as string,
      link: buildFormularioPublicUrl(existing.token as string),
      formulario: existing,
    };
  }

  const result = await criarFormularioLink({
    ownerEmail: params.ownerEmail,
    tipo: 'cliente',
    clienteDriveId: params.clienteDriveId,
    nomePaciente: params.nomeCliente,
    nomeClinica: params.nomeClinica,
  });

  return {
    token: result.token,
    link: result.link,
    formulario: result.formulario,
  };
}

export async function criarFormularioLink(params: {
  ownerEmail: string;
  tipo: FormularioLinkTipo;
  clienteDriveId?: string | null;
  titulo?: string;
  nomeClinica?: string;
  nomePaciente?: string;
  mensagemWhatsapp?: string;
  expiresAt?: string | null;
  telefoneDestino?: string | null;
}) {
  const token = randomBytes(24).toString('hex');
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const link = `${baseUrl}/f/${token}`;

  const titulo =
    params.titulo ||
    (params.tipo === 'autocadastro' ? 'Cadastre-se na clínica' : 'Cadastro de paciente');

  const mensagemPadrao =
    params.tipo === 'autocadastro'
      ? buildAutocadastroWhatsAppMessage({ nomeClinica: params.nomeClinica, link })
      : buildFormularioWhatsAppMessage({
          nomeClinica: params.nomeClinica,
          nomePaciente: params.nomePaciente,
          link,
        });

  const mensagem = params.mensagemWhatsapp || mensagemPadrao;

  if (params.tipo === 'autocadastro') {
    await supabaseAdmin
      .from('formulario_links')
      .update({ ativo: false })
      .eq('owner_email', params.ownerEmail)
      .is('cliente_drive_id', null);
  }

  const { data, error } = await supabaseAdmin
    .from('formulario_links')
    .insert({
      token,
      owner_email: params.ownerEmail,
      cliente_drive_id: params.clienteDriveId ?? null,
      titulo,
      mensagem_whatsapp: mensagem,
      ativo: true,
      expires_at: params.expiresAt ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  const whatsapp_url = params.telefoneDestino
    ? buildWhatsAppUrl(params.telefoneDestino, mensagem)
    : buildWhatsAppUrl(null, mensagem);

  return { link, token, formulario: data, mensagem_whatsapp: mensagem, whatsapp_url };
}

export function supabaseSchemaErrorResponse(error: { code?: string; message?: string }) {
  if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
    return {
      error:
        'Tabelas do Supabase não criadas. Execute sql/operacional_schema.sql',
      code: 'SUPABASE_SCHEMA_MISSING',
      status: 503,
    };
  }
  return { error: error.message || 'Erro', status: 500 };
}
