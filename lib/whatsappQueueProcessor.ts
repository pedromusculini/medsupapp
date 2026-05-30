import { supabaseAdmin } from '@/lib/supabaseClient';
import { getWhatsAppCloudConfig, isWhatsAppCloudConfigured } from '@/lib/whatsappConfig';
import { sendTemplateMessage, sendInteractiveConfirmButtons } from '@/lib/whatsappCloud';
import { upsertWhatsAppConversa } from '@/lib/whatsappConversa';
import type { WhatsAppMessageType } from '@/lib/whatsapp';
import {
  buildAutocadastroWhatsAppMessage,
  buildFormularioWhatsAppMessage,
} from '@/lib/whatsapp';

export type WhatsAppFilaRow = {
  id: string;
  owner_email: string;
  telefone: string;
  tipo: string;
  payload: Record<string, unknown> & {
    tipo?: WhatsAppMessageType;
    provider?: string;
  };
  status: string;
  erro: string | null;
  created_at: string;
};

function templateParamsForRow(row: WhatsAppFilaRow): {
  templateName: string;
  params: string[];
} | { error: string } {
  const config = getWhatsAppCloudConfig();
  if (!config) {
    return { error: 'WhatsApp Cloud API não configurada no servidor.' };
  }

  const p = row.payload;
  const tipo = (row.tipo || p.tipo) as WhatsAppMessageType;

  switch (tipo) {
    case 'formulario_link':
    case 'autocadastro_link': {
      const name = config.templates.formularioLink;
      if (!name) {
        return {
          error:
            'Defina WHATSAPP_TEMPLATE_FORMULARIO_LINK com o nome do template aprovado na Meta.',
        };
      }
      const link = String(p.link ?? '');
      const nomeClinica = String(p.nomeClinica ?? 'sua clínica');
      const nomePaciente = String(p.nomePaciente ?? p.paciente ?? 'paciente');
      return { templateName: name, params: [nomePaciente, nomeClinica, link] };
    }
    case 'lembrete_consulta': {
      const name = config.templates.lembreteConsulta;
      if (!name) {
        return {
          error:
            'Defina WHATSAPP_TEMPLATE_LEMBRETE_CONSULTA com o nome do template aprovado na Meta.',
        };
      }
      return {
        templateName: name,
        params: [
          String(p.paciente ?? 'Paciente'),
          String(p.data ?? ''),
          String(p.hora ?? ''),
          String(p.servico ?? 'Consulta'),
          String(p.local ?? 'A confirmar'),
        ],
      };
    }
    case 'formulario_recebido': {
      const name = config.templates.formularioRecebido;
      if (!name) {
        return {
          error:
            'Template de confirmação não configurado (WHATSAPP_TEMPLATE_FORMULARIO_RECEBIDO). Mensagem ignorada.',
        };
      }
      return {
        templateName: name,
        params: [String(p.paciente ?? 'Paciente'), String(p.nomeClinica ?? 'Clínica')],
      };
    }
    case 'confirmacao_pagamento': {
      const name = config.templates.confirmacaoPagamento;
      if (!name) {
        return { error: 'WHATSAPP_TEMPLATE_CONFIRMACAO_PAGAMENTO não configurado.' };
      }
      return {
        templateName: name,
        params: [
          String(p.paciente ?? 'Paciente'),
          String(p.valor ?? ''),
          String(p.referencia ?? ''),
        ],
      };
    }
    default:
      return { error: `Tipo de mensagem não suportado: ${tipo}` };
  }
}

export async function processWhatsAppFilaRow(
  row: WhatsAppFilaRow,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  if (!isWhatsAppCloudConfigured()) {
    return { ok: false, error: 'WhatsApp Cloud API não configurada.' };
  }

  const mapped = templateParamsForRow(row);
  if ('error' in mapped) {
    await supabaseAdmin
      .from('whatsapp_fila')
      .update({
        status: 'erro',
        erro: mapped.error,
      })
      .eq('id', row.id);
    return { ok: false, error: mapped.error };
  }

  const result = await sendTemplateMessage(
    row.telefone,
    mapped.templateName,
    mapped.params,
  );

  if (!result.ok) {
    await supabaseAdmin
      .from('whatsapp_fila')
      .update({
        status: 'erro',
        erro: result.error,
      })
      .eq('id', row.id);
    return { ok: false, error: result.error };
  }

  await supabaseAdmin
    .from('whatsapp_fila')
    .update({
      status: 'enviado',
      enviado_em: new Date().toISOString(),
      erro: null,
      payload: {
        ...row.payload,
        provider: 'meta_cloud',
        meta_message_id: result.messageId,
      },
    })
    .eq('id', row.id);

  const tipo = (row.tipo || row.payload.tipo) as WhatsAppMessageType;
  if (tipo === 'lembrete_consulta') {
    const consultaId = String(row.payload.consultaId ?? '');
    if (consultaId) {
      await upsertWhatsAppConversa({
        ownerEmail: row.owner_email,
        telefone: row.telefone,
        consultaId,
      });
      const btn = await sendInteractiveConfirmButtons(
        row.telefone,
        consultaId,
        'Toque em Confirmar ou Cancelar para atualizar sua consulta.',
      );
      if (!btn.ok) {
        console.warn('[whatsapp] botões confirmação:', btn.error);
      }
    }
  }

  return { ok: true, messageId: result.messageId };
}

export async function processPendingWhatsAppQueue(limit = 25): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: boolean;
  errors: string[];
}> {
  if (!isWhatsAppCloudConfigured()) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      errors: ['WhatsApp Cloud API não configurada'],
    };
  }

  const { data: rows, error } = await supabaseAdmin
    .from('whatsapp_fila')
    .select('*')
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: false,
      errors: [error.message],
    };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of (rows ?? []) as WhatsAppFilaRow[]) {
    const out = await processWhatsAppFilaRow(row);
    if (out.ok) sent++;
    else {
      failed++;
      if (out.error) errors.push(out.error);
    }
  }

  return {
    processed: rows?.length ?? 0,
    sent,
    failed,
    skipped: false,
    errors,
  };
}

/** Monta texto de fallback (wa.me) quando API não envia */
export function buildQueueFallbackText(row: WhatsAppFilaRow): string {
  const p = row.payload;
  const tipo = row.tipo as WhatsAppMessageType;

  if (tipo === 'formulario_link' && p.link) {
    return buildFormularioWhatsAppMessage({
      nomeClinica: String(p.nomeClinica ?? ''),
      nomePaciente: String(p.nomePaciente ?? p.paciente ?? ''),
      link: String(p.link),
    });
  }
  if (tipo === 'autocadastro_link' && p.link) {
    return buildAutocadastroWhatsAppMessage({
      nomeClinica: String(p.nomeClinica ?? ''),
      link: String(p.link),
    });
  }
  if (tipo === 'lembrete_consulta') {
    return (
      `Olá ${p.paciente ?? ''}! Lembrete: consulta em ${p.data ?? ''} às ${p.hora ?? ''} — ` +
      `${p.servico ?? 'Consulta'}. Local: ${p.local ?? 'A confirmar'}.`
    );
  }
  return String(p.texto ?? 'Mensagem MedSupAPP');
}
