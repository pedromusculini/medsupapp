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

export default function BackupPageClient() {
  const [events, setEvents] = useState<ConsultationEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setEvents(JSON.parse(stored));
    }
  }, []);

  const count = useMemo(() => events.length, [events]);

  function downloadCsv() {
    const header = ["Título", "Paciente", "Serviço", "Valor", "Início", "Fim"];
    const rows = events.map((item) => [
      item.title ?? "",
      item.patient ?? "",
      item.service ?? "",
      (item.value ?? 0).toFixed(2),
      item.start?.toString() ?? "",
      item.end?.toString() ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "medsupapp-backup.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage("CSV exportado com sucesso.");
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-[#d4f5d4] px-3 py-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
                Backup seguro
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Exportação rápida para CSV e Google Drive.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Guarde os dados da clínica em arquivo e prepare o histórico para o seu Google Drive.
              </p>
            </div>
            <Link
              href="/financeiro"
              className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Ir para financeiro
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Exportar dados</p>
            <p className="mt-3 text-slate-600">Baixe um arquivo CSV com as consultas atuais e mantenha um backup local.</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={downloadCsv}
                className="inline-flex items-center justify-center rounded-2xl bg-[#90EE90] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#7ad47a]"
              >
                Baixar CSV ({count})
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-500"
              >
                Google Drive (em breve)
              </button>
            </div>

            {message ? <p className="mt-4 rounded-3xl bg-[#f8fff8] p-4 text-sm text-slate-700">{message}</p> : null}
          </div>

          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">O que é exportado</p>
            <ul className="mt-4 space-y-3 text-slate-700">
              <li className="rounded-3xl bg-[#f4fff4] p-4">Título da consulta e paciente.</li>
              <li className="rounded-3xl bg-[#f4fff4] p-4">Serviço, valor, início e fim.</li>
              <li className="rounded-3xl bg-[#f4fff4] p-4">Perfeito para receber no Google Drive mais tarde.</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
