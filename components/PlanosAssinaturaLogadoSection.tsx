'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Quem já tem conta deve alterar plano em Meu Perfil (mesmos avisos de downgrade).
 * /planos permanece focado em novos cadastros.
 */
export default function PlanosAssinaturaLogadoSection() {
  const { status } = useSession();

  if (status !== 'authenticated') return null;

  return (
    <section className="border-t border-amber-200 bg-amber-50/80 py-10">
      <div className="mx-auto max-w-3xl px-6">
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-3 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">Já é cliente MedSupAPP?</p>
            <p>
              A troca de plano (upgrade ou downgrade) é feita em{' '}
              <strong>Meu Perfil → Assinatura</strong>, com os mesmos avisos de segurança:
              médicos excedentes saem da plataforma no downgrade, e prontuários continuam no
              seu Google Drive — exporte em Backup antes, se precisar.
            </p>
            <Link
              href="/dashboard/perfil"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Ir para Meu Perfil
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
