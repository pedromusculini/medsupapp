import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCloudConfig } from '@/lib/whatsappConfig';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { handleInboundWhatsAppMessage } from '@/lib/whatsappInbound';

export const runtime = 'nodejs';

/** Verificação do webhook Meta (GET) */
export async function GET(req: NextRequest) {
  const config = getWhatsAppCloudConfig();
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    config &&
    token === config.verifyToken &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verificação falhou' }, { status: 403 });
}

type WebhookBody = {
  object?: string;
  entry?: {
    id: string;
    changes: {
      field: string;
      value: {
        metadata?: { phone_number_id?: string };
        statuses?: {
          id: string;
          status: string;
          timestamp: string;
          errors?: { title?: string; message?: string }[];
        }[];
        messages?: {
          from: string;
          id: string;
          timestamp: string;
          type: string;
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
          };
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
};

/** Eventos de entrega e mensagens recebidas (POST) */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as WebhookBody;

  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ received: true });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value;

      for (const st of value.statuses ?? []) {
        if (!st.id) continue;
        const metaStatus = st.status;
        if (metaStatus === 'failed') {
          const errMsg =
            st.errors?.map((e) => e.message || e.title).filter(Boolean).join('; ') ||
            'Falha no envio WhatsApp';
          const { data: rows } = await supabaseAdmin
            .from('whatsapp_fila')
            .select('id, payload')
            .in('status', ['enviado', 'pendente'])
            .order('created_at', { ascending: false })
            .limit(100);
          for (const row of rows ?? []) {
            const payload = row.payload as { meta_message_id?: string };
            if (payload?.meta_message_id === st.id) {
              await supabaseAdmin
                .from('whatsapp_fila')
                .update({ status: 'erro', erro: errMsg })
                .eq('id', row.id);
            }
          }
        }
      }

      for (const msg of value.messages ?? []) {
        try {
          await handleInboundWhatsAppMessage(msg);
        } catch (e) {
          console.error('[whatsapp/webhook] inbound:', e);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
