/**
 * Utilitários para integração WhatsApp (link wa.me agora; API oficial depois).
 */

export type WhatsAppMessageType =
  | 'formulario_link'
  | 'autocadastro_link'
  | 'formulario_recebido'
  | 'lembrete_consulta'
  | 'confirmacao_pagamento';

export function normalizeBrazilPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

/**
 * Abre WhatsApp com mensagem pré-preenchida.
 * Sem telefone: abre seletor de contato (ideal para compartilhar link de autocadastro).
 */
export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const text = encodeURIComponent(message);
  if (!phone?.trim()) {
    return `https://wa.me/?text=${text}`;
  }
  const normalized = normalizeBrazilPhone(phone);
  return `https://wa.me/${normalized}?text=${text}`;
}

export function buildFormularioWhatsAppMessage(params: {
  nomeClinica?: string;
  nomePaciente?: string;
  link: string;
}): string {
  const clinica = params.nomeClinica ? `${params.nomeClinica}` : 'sua clínica';
  const saudacao = params.nomePaciente
    ? `Olá, ${params.nomePaciente}!`
    : 'Olá!';
  return `${saudacao}\n\n${clinica} solicitou que você preencha seus dados pelo link abaixo (leva menos de 2 minutos):\n\n${params.link}\n\nObrigado!`;
}

/** Mensagem para divulgar link de autocadastro (paciente ainda não cadastrado) */
export function buildAutocadastroWhatsAppMessage(params: {
  nomeClinica?: string;
  link: string;
}): string {
  const clinica = params.nomeClinica || 'nossa clínica';
  return (
    `Olá! Você foi convidado(a) a fazer seu cadastro em ${clinica}.\n\n` +
    `Preencha seus dados pelo link (leva menos de 2 minutos):\n${params.link}\n\n` +
    `Em breve também enviaremos pelo WhatsApp Business. Obrigado!`
  );
}

/** Payload padronizado para fila Supabase */
export function buildWhatsAppQueuePayload(
  tipo: WhatsAppMessageType,
  data: Record<string, unknown>,
) {
  const provider = process.env.WHATSAPP_TOKEN ? 'meta_cloud' : 'pending';
  return {
    tipo,
    provider,
    criado_em: new Date().toISOString(),
    ...data,
  };
}

export function buildLembreteConsultaPayload(params: {
  paciente: string;
  servico: string;
  inicio: string;
  fim?: string;
  local?: string;
  nomeClinica?: string;
  consultaId?: string;
}) {
  const start = new Date(params.inicio);
  const data = start.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = start.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return buildWhatsAppQueuePayload('lembrete_consulta', {
    paciente: params.paciente,
    servico: params.servico,
    data,
    hora,
    local: params.local || 'A confirmar',
    nomeClinica: params.nomeClinica || 'MedSupAPP',
    inicio: params.inicio,
    fim: params.fim,
    consultaId: params.consultaId,
  });
}

export async function enqueueWhatsAppMessage(input: {
  ownerEmail: string;
  telefone: string;
  tipo: WhatsAppMessageType;
  payload: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import('@/lib/supabaseClient');
  const telefone = input.telefone.replace(/\D/g, '');
  if (telefone.length < 10) {
    throw new Error('Telefone inválido para fila WhatsApp');
  }
  const { data, error } = await supabaseAdmin
    .from('whatsapp_fila')
    .insert({
      owner_email: input.ownerEmail.toLowerCase().trim(),
      telefone,
      tipo: input.tipo,
      payload: buildWhatsAppQueuePayload(input.tipo, input.payload),
      status: 'pendente',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
