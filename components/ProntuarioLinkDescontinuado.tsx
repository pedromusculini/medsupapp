'use client';

import Link from 'next/link';
import { AlertCircle, Calendar, LogIn, Stethoscope } from 'lucide-react';

type Props = {
  token?: string;
};

/** Página de transição para links antigos do Google Calendar (`/prontuario/[token]`). */
export default function ProntuarioLinkDescontinuado({ token: _token }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 mb-6 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Link descontinuado</p>
            <p className="text-sm text-amber-800 mt-1">
              Este atalho de prontuário não está mais disponível. O acesso agora é feito com login
              Google e agenda conectada.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="rounded-xl bg-emerald-600/10 p-3">
              <Stethoscope className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                MedSupAPP
              </p>
              <h1 className="text-lg font-semibold text-slate-900">Como acessar o prontuário</h1>
            </div>
          </div>

          <ol className="space-y-4 text-sm text-slate-700">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                1
              </span>
              <span>
                Abra o evento da consulta no <strong>Google Calendar</strong> e toque em{' '}
                <strong>Local</strong> — o link da ficha do paciente está lá.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                2
              </span>
              <span>
                Faça login com o <strong>Google</strong> da clínica ou do médico (com agenda
                conectada).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                3
              </span>
              <span>
                Consulte o histórico e registre evoluções na ficha do paciente.
              </span>
            </li>
          </ol>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <LogIn className="h-4 w-4" />
              Entrar com Google
            </Link>
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Calendar className="h-4 w-4" />
              Abrir Google Calendar
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Dúvidas? Peça à clínica um novo convite de agenda Google em Configurações → Equipe.
        </p>
      </div>
    </div>
  );
}
