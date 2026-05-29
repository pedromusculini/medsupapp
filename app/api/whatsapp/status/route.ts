import { NextResponse } from 'next/server';
import { isWhatsAppCloudConfigured, getWhatsAppCloudConfig } from '@/lib/whatsappConfig';

export async function GET() {
  const configured = isWhatsAppCloudConfigured();
  const config = getWhatsAppCloudConfig();

  return NextResponse.json({
    configured,
    templates: configured
      ? {
          formulario_link: !!config?.templates.formularioLink,
          lembrete_consulta: !!config?.templates.lembreteConsulta,
          formulario_recebido: !!config?.templates.formularioRecebido,
          confirmacao_pagamento: !!config?.templates.confirmacaoPagamento,
        }
      : null,
    docs: '/docs/WHATSAPP_BUSINESS_SETUP.md',
  });
}
