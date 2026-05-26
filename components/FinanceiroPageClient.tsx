"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EventInput } from "@fullcalendar/core";

type ConsultationEvent = EventInput & {
  patient?: string;
  service?: string;
  value?: number;
};

const STORAGE_KEY = "medsupapp-consultations";

export default function FinanceiroPageClient() {
  const [events, setEvents] = useState<ConsultationEvent[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setEvents(JSON.parse(stored));
    }
  }, []);

  const totalRevenue = useMemo(
    () => events.reduce((sum, item) => sum + Number(item.value ?? 0), 0),
    [events],
  );

  const repasse = useMemo(() => totalRevenue * 0.15, [totalRevenue]);
  const netRevenue = useMemo(() => totalRevenue - repasse, [totalRevenue, repasse]);

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-[#d4f5d4] px-3 py-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
                Financeiro rápido
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Controle simples de receitas e repasses.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Visualize quanto entrou, quanto será repassado e o saldo disponível para a clínica.
              </p>
            </div>
            <Link
              href="/agenda"
              className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Voltar para agenda
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Receita total</p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">R$ {totalRevenue.toFixed(2)}</p>
            <p className="mt-2 text-sm text-slate-600">Valor acumulado de todas as consultas.</p>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Repasse automático</p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">R$ {repasse.toFixed(2)}</p>
            <p className="mt-2 text-sm text-slate-600">15% calculado automaticamente sobre o total.</p>
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Saldo para clínica</p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">R$ {netRevenue.toFixed(2)}</p>
            <p className="mt-2 text-sm text-slate-600">Receita líquida após repasse.</p>
          </div>
        </div>

        <div className="mt-6 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Transações recentes</p>
              <p className="mt-2 text-sm text-slate-600">Baseado nas consultas armazenadas localmente.</p>
            </div>
            <span className="rounded-full bg-[#f4fff4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
              Atualizado automaticamente
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {events.length === 0 ? (
              <p className="rounded-3xl bg-[#f8fff8] p-4 text-sm text-slate-600">Nenhuma consulta registrada ainda.</p>
            ) : (
              events.map((item) => (
                <div key={String(item.id)} className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-[#f8fff8] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.patient ?? "Paciente"}</p>
                    <p className="text-sm text-slate-600">{item.service ?? "Consulta médica"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">{item.start?.toString().slice(0, 16).replace("T", " ")}</p>
                    <p className="text-lg font-semibold text-slate-950">R$ {(item.value ?? 0).toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
