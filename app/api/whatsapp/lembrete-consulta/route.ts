import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { enqueueWhatsAppMessage } from '@/lib/whatsapp';
import { isWhatsAppCloudConfigured } from '@/lib/whatsappConfig';
import {
  processWhatsAppFilaRow,
  type WhatsAppFilaRow,
} from '@/lib/whatsappQueueProcessor';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const telefone = String(body.telefone ?? '').replace(/\D/g, '');
  const paciente = String(body.paciente ?? '').trim();
  const servico = String(body.servico ?? 'Consulta').trim();
  const inicio = String(body.inicio ?? '');

  if (!telefone || telefone.length < 10) {
    return NextResponse.json(
      { error: 'Informe o telefone do paciente para enviar lembrete.' },
      { status: 400 },
    );
  }
  if (!paciente) {
    return NextResponse.json({ error: 'Nome do paciente obrigatório' }, { status: 400 });
  }
  if (!inicio) {
    return NextResponse.json({ error: 'Data/hora da consulta obrigatória' }, { status: 400 });
  }

  try {
    const start = new Date(inicio);
    const row = await enqueueWhatsAppMessage({
      ownerEmail: email,
      telefone,
      tipo: 'lembrete_consulta',
      payload: {
        paciente,
        servico,
        inicio,
        fim: body.fim ? String(body.fim) : undefined,
        local: body.local ? String(body.local) : undefined,
        nomeClinica: body.nomeClinica ? String(body.nomeClinica) : undefined,
        consultaId: body.consultaId ? String(body.consultaId) : undefined,
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

    let autoSent = false;
    let sendError: string | undefined;
    if (isWhatsAppCloudConfigured()) {
      const out = await processWhatsAppFilaRow(row as WhatsAppFilaRow);
      autoSent = out.ok;
      sendError = out.error;
    }

    return NextResponse.json({
      success: true,
      fila_id: row.id,
      auto_sent: autoSent,
      whatsapp_configured: isWhatsAppCloudConfigured(),
      error: sendError,
      message: autoSent
        ? 'Lembrete enviado pelo WhatsApp Business.'
        : 'Lembrete na fila. Configure templates Meta ou aguarde o processamento automático.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao enfileirar lembrete';
    if (message.includes('PGRST205')) {
      return NextResponse.json(
        { error: 'Execute sql/operacional_schema.sql no Supabase.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
