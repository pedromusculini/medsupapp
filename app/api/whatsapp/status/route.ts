import { NextResponse } from 'next/server';
import { isWhatsAppCloudConfigured, getWhatsAppCloudConfig } from '@/lib/whatsappConfig';

export async function GET() {
  const configured = isWhatsAppCloudConfigured();
  const config = getWhatsAppCloudConfig();

  const templates = configured
    ? {
        formulario_link: !!config?.templates.formularioLink,
        lembrete_consulta: !!config?.templates.lembreteConsulta,
        formulario_recebido: !!config?.templates.formularioRecebido,
        confirmacao_pagamento: !!config?.templates.confirmacaoPagamento,
      }
    : null;

  return NextResponse.json({
    configured,
    templates,
    features: {
      lembretes_d7_d1: configured && !!templates?.lembrete_consulta,
      confirmacao_botoes: configured,
      sync_consultas: true,
    },
    cron: {
      lembrete_agendado: '/api/whatsapp/lembrete-agendado',
      process_fila: '/api/whatsapp/process',
    },
    docs: 'docs/WHATSAPP_BUSINESS_SETUP.md',
  });
}
