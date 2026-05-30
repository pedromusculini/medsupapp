'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, CheckCircle2, AlertCircle } from 'lucide-react';

type WhatsAppStatus = {
  configured: boolean;
  templates?: {
    formulario_link: boolean;
    lembrete_consulta: boolean;
    formulario_recebido: boolean;
    confirmacao_pagamento: boolean;
  };
};

export default function WhatsAppStatusCard() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/whatsapp/status')
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ configured: false }))
      .finally(() => setLoading(false));
  }, []);

  const lembreteOk = status?.templates?.lembrete_consulta ?? false;
  const ready = status?.configured && lembreteOk;

  return (
    <div className="rounded-2xl border border-green-100 bg-[#f7fff7] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#013a01] text-white">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">WhatsApp Business</h3>
          {loading ? (
            <p className="mt-1 text-sm text-gray-500">Verificando configuração...</p>
          ) : ready ? (
            <p className="mt-1 text-sm text-[#228B22] flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Ativo — lembretes 7 e 1 dia antes e confirmação Sim/Não.
            </p>
          ) : (
            <p className="mt-1 text-sm text-amber-800 flex items-start gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {status?.configured
                ? 'API conectada, mas falta template de lembrete (WHATSAPP_TEMPLATE_LEMBRETE_CONSULTA).'
                : 'Pendente — variáveis Meta na Vercel e webhook.'}
            </p>
          )}
          <ul className="mt-3 text-xs text-gray-600 space-y-1">
            <li>• Marque &quot;Enviar lembretes WhatsApp&quot; ao agendar (com telefone do paciente).</li>
            <li>• Cron diário envia lembretes D-7 e D-1; paciente confirma ou cancela pelos botões.</li>
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Configuração: variáveis WHATSAPP_* na Vercel, SQL operacional + consultas_whatsapp no
            Supabase, webhook Meta em /api/whatsapp/webhook.
          </p>
        </div>
      </div>
    </div>
  );
}
