import { enqueueWhatsAppMessage } from '@/lib/whatsapp';
import {
  listConsultasParaLembrete,
  markLembreteEnviado,
  wasLembreteEnviado,
  type LembreteTipo,
} from '@/lib/consultasAgenda';
import { upsertWhatsAppConversa } from '@/lib/whatsappConversa';
import { isWhatsAppCloudConfigured } from '@/lib/whatsappConfig';
import {
  processPendingWhatsAppQueue,
  processWhatsAppFilaRow,
  type WhatsAppFilaRow,
} from '@/lib/whatsappQueueProcessor';

function labelDias(tipo: LembreteTipo): string {
  return tipo === 'd7' ? '7 dias' : '1 dia';
}

async function enqueueLembreteForConsulta(
  consulta: Awaited<ReturnType<typeof listConsultasParaLembrete>>[number],
  tipo: LembreteTipo,
): Promise<{ ok: boolean; error?: string; filaId?: string }> {
  const telefone = consulta.telefone?.replace(/\D/g, '') ?? '';
  if (telefone.length < 10) {
    return { ok: false, error: 'Telefone inválido' };
  }

  const start = new Date(consulta.inicio);
  const prefix = tipo === 'd7' ? '[7 dias] ' : '[1 dia] ';

  try {
    const row = await enqueueWhatsAppMessage({
      ownerEmail: consulta.owner_email,
      telefone,
      tipo: 'lembrete_consulta',
      payload: {
        paciente: consulta.paciente,
        servico: `${prefix}${consulta.servico}`,
        inicio: consulta.inicio,
        fim: consulta.fim ?? undefined,
        local: consulta.local ?? undefined,
        consultaId: consulta.id,
        lembrete_tipo: tipo,
        data: start.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        hora: start.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    });

    let sent = false;
    if (isWhatsAppCloudConfigured()) {
      const out = await processWhatsAppFilaRow(row as WhatsAppFilaRow);
      sent = out.ok;
      if (!out.ok) return { ok: false, error: out.error, filaId: row.id };
    }

    await markLembreteEnviado({
      consultaId: consulta.id,
      ownerEmail: consulta.owner_email,
      tipo,
      filaId: row.id,
    });

    await upsertWhatsAppConversa({
      ownerEmail: consulta.owner_email,
      telefone,
      consultaId: consulta.id,
    });

    return { ok: true, filaId: row.id };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao enfileirar' };
  }
}

export async function processScheduledWhatsAppReminders(): Promise<{
  scanned_d7: number;
  scanned_d1: number;
  enqueued_d7: number;
  enqueued_d1: number;
  skipped: boolean;
  errors: string[];
}> {
  if (!isWhatsAppCloudConfigured()) {
    return {
      scanned_d7: 0,
      scanned_d1: 0,
      enqueued_d7: 0,
      enqueued_d1: 0,
      skipped: true,
      errors: ['WhatsApp Cloud API não configurada'],
    };
  }

  const errors: string[] = [];
  let enqueued_d7 = 0;
  let enqueued_d1 = 0;
  let scanned_d7 = 0;
  let scanned_d1 = 0;

  for (const tipo of ['d7', 'd1'] as LembreteTipo[]) {
    let list: Awaited<ReturnType<typeof listConsultasParaLembrete>> = [];
    try {
      list = await listConsultasParaLembrete(tipo);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao listar consultas';
      if (msg.includes('PGRST205') || msg.includes('consultas_agenda')) {
        return {
          scanned_d7: 0,
          scanned_d1: 0,
          enqueued_d7: 0,
          enqueued_d1: 0,
          skipped: true,
          errors: ['Execute sql/consultas_whatsapp_schema.sql no Supabase.'],
        };
      }
      errors.push(msg);
      continue;
    }

    if (tipo === 'd7') scanned_d7 = list.length;
    else scanned_d1 = list.length;

    for (const consulta of list) {
      try {
        const already = await wasLembreteEnviado(consulta.id, tipo);
        if (already) continue;

        const out = await enqueueLembreteForConsulta(consulta, tipo);
        if (out.ok) {
          if (tipo === 'd7') enqueued_d7++;
          else enqueued_d1++;
        } else if (out.error) {
          errors.push(`${labelDias(tipo)} ${consulta.id}: ${out.error}`);
        }
      } catch (e: unknown) {
        errors.push(
          `${labelDias(tipo)} ${consulta.id}: ${e instanceof Error ? e.message : 'erro'}`,
        );
      }
    }
  }

  await processPendingWhatsAppQueue(50);

  return {
    scanned_d7,
    scanned_d1,
    enqueued_d7,
    enqueued_d1,
    skipped: false,
    errors,
  };
}
