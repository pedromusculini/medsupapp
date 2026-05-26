import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f9fa]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex rounded-full bg-[#d4f5d4] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
              MedSupAPP
            </span>
            <h1 className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Agenda, lembretes e financeiro para clínicas pequenas.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Plataforma simples, bonita e confiável para consultórios com até 10 médicos. Mais tempo para o atendimento, menos tarefa administrativa.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-[#90EE90] px-6 py-4 text-base font-semibold text-slate-950 shadow-md transition hover:bg-[#7ad47a]"
              >
                Entrar / Conectar Google
              </Link>
              <Link
                href="/agenda"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Ver demo rápida
              </Link>
            </div>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="space-y-6">
              <div className="rounded-3xl bg-[#f4fff4] p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Agenda inteligente</p>
                <p className="mt-3 text-slate-700">Arraste horários, visualize o dia inteiro e mantenha o consultório alinhado em poucos cliques.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">Lembretes por WhatsApp</p>
                  <p className="mt-1 text-sm text-slate-600">7 dias e 1 dia antes da consulta.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">Financeiro simples</p>
                  <p className="mt-1 text-sm text-slate-600">Registre entradas, saídas e repasses percentuais.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">Backup CSV</p>
                  <p className="mt-1 text-sm text-slate-600">Exporte agenda e receitas em segundos.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">Google Calendar</p>
                  <p className="mt-1 text-sm text-slate-600">Login Google para agenda conectada.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
