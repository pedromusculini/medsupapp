'use client';

import Link from 'next/link';
import { MessageCircle, ChevronRight, Calendar } from 'lucide-react';

export default function ComunicacaoLinkCard() {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-5 border border-emerald-200/50 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-200/40">
          <MessageCircle className="w-6 h-6 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900">WhatsApp e agendamento online</h3>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">
            Personalize lembretes (7 e 1 dia), link público para pacientes marcarem consulta e
            botão &quot;adicionar à agenda&quot; — tudo via{' '}
            <strong className="text-emerald-600">wa.me</strong> no seu celular, sem API Meta.
          </p>
          <Link
            href="/dashboard/configuracoes"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Configurar comunicação
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
