import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { buildWhatsAppQueuePayload } from '@/lib/whatsapp';
import { isWhatsAppCloudConfigured } from '@/lib/whatsappConfig';
import {
  processWhatsAppFilaRow,
  type WhatsAppFilaRow,
} from '@/lib/whatsappQueueProcessor';

/** Enfileira mensagem WhatsApp e tenta enviar via Meta Cloud API se configurada. */
export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json();
  const telefone = String(body.telefone ?? '').replace(/\D/g, '');
  const tipo = body.tipo || 'formulario_link';

  if (!telefone || telefone.length < 10) {
    return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_fila')
    .insert({
      owner_email: email,
      telefone,
      tipo,
      payload: buildWhatsAppQueuePayload(tipo, body.payload ?? {}),
      status: 'pendente',
    })
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST205') {
      return NextResponse.json(
        { error: 'Execute sql/operacional_schema.sql no Supabase primeiro.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let autoSent = false;
  let sendError: string | undefined;
  if (isWhatsAppCloudConfigured()) {
    const out = await processWhatsAppFilaRow(data as WhatsAppFilaRow);
    autoSent = out.ok;
    sendError = out.error;
  }

  return NextResponse.json({
    fila: data,
    auto_sent: autoSent,
    whatsapp_configured: isWhatsAppCloudConfigured(),
    error: sendError,
    message: autoSent
      ? 'Mensagem enviada pelo WhatsApp Business.'
      : isWhatsAppCloudConfigured()
        ? 'Mensagem enfileirada; verifique templates ou erro retornado.'
        : 'Mensagem enfileirada. Configure a API (docs/WHATSAPP_BUSINESS_SETUP.md) ou use o link wa.me.',
  });
}
