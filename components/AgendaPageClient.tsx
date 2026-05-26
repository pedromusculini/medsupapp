"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { EventInput } from "@fullcalendar/core";
import AgendaCalendar from "@/components/AgendaCalendar";

const STORAGE_KEY = "medsupapp-consultations";
const CALENDAR_KEY = "medsupapp-calendar-connected";

type ConsultationEvent = EventInput & {
  patient?: string;
  service?: string;
  value?: number;
};

type AgendaPageClientProps = {
  userEmail: string;
  provider?: string | null;
};

const defaultConsultations: ConsultationEvent[] = [
  {
    id: "1",
    title: "Consulta - João Silva",
    patient: "João Silva",
    service: "Acompanhamento clínico",
    value: 180,
    start: "2026-05-28T09:00:00",
    end: "2026-05-28T09:40:00",
    backgroundColor: "#90EE90",
    borderColor: "#228B22",
  },
  {
    id: "2",
    title: "Retorno - Maria Souza",
    patient: "Maria Souza",
    service: "Retorno cardiologia",
    value: 220,
    start: "2026-05-28T10:30:00",
    end: "2026-05-28T11:00:00",
    backgroundColor: "#A8E6A8",
    borderColor: "#228B22",
  },
  {
    id: "3",
    title: "Avaliação - Clínica",
    patient: "Equipe Clínica",
    service: "Avaliação geral",
    value: 280,
    start: "2026-05-29T14:00:00",
    end: "2026-05-29T14:45:00",
    backgroundColor: "#90EE90",
    borderColor: "#228B22",
  },
];

function parseGoogleEvent(item: any): ConsultationEvent {
  const start = item.start?.dateTime || item.start?.date || "";
  const end = item.end?.dateTime || item.end?.date || "";
  return {
    id: item.id ?? String(Math.random()),
    title: `Google: ${item.summary ?? "Evento"}`,
    patient: item.attendees?.[0]?.email ?? "Convidado",
    service: item.summary ?? "Evento de agenda",
    value: 0,
    start,
    end,
    backgroundColor: "#d4f5d4",
    borderColor: "#228B22",
  };
}

export default function AgendaPageClient({ userEmail, provider }: AgendaPageClientProps) {
  const [events, setEvents] = useState<ConsultationEvent[]>(defaultConsultations);
  const [patient, setPatient] = useState("Novo paciente");
  const [service, setService] = useState("Consulta médica");
  const [value, setValue] = useState(200);
  const [start, setStart] = useState("2026-05-30T08:00");
  const [end, setEnd] = useState("2026-05-30T08:40");
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const storedEvents = window.localStorage.getItem(STORAGE_KEY);
    const connected = window.localStorage.getItem(CALENDAR_KEY) === "true";

    Promise.resolve().then(() => {
      if (storedEvents) {
        setEvents(JSON.parse(storedEvents));
      }
      setIsCalendarConnected(connected);
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  const upcomingAppointment = useMemo(() => events[0], [events]);
  const totalRevenue = useMemo(
    () => events.reduce((sum, item) => sum + Number(item.value ?? 0), 0),
    [events],
  );
  const connectedLabel = isCalendarConnected ? "Conectado" : "Não conectado";

  function handleAddConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEvent: ConsultationEvent = {
      id: String(Date.now()),
      title: `${service} - ${patient}`,
      patient,
      service,
      value,
      start,
      end,
      backgroundColor: "#90EE90",
      borderColor: "#228B22",
    };
    setEvents((current) => [nextEvent, ...current]);
  }

  function handleRemoveConsultation(id: string) {
    setEvents((current) => current.filter((item) => item.id !== id));
  }

  async function handleGoogleSync() {
    setSyncMessage(null);
    if (provider !== "google") {
      setSyncMessage("Faça login com Google para conectar a agenda do Google Calendar.");
      return;
    }

    setIsSyncing(true);
    const response = await fetch("/api/google-calendar");
    setIsSyncing(false);

    if (!response.ok) {
      const data = await response.json();
      setSyncMessage(data?.error ?? "Falha ao sincronizar com o Google Calendar.");
      return;
    }

    const data = await response.json();
    const newEvents = Array.isArray(data.items)
      ? data.items.map(parseGoogleEvent)
      : [];

    if (newEvents.length === 0) {
      setSyncMessage("Nenhum evento novo encontrado no Google Calendar.");
      return;
    }

    setEvents((current) => [...newEvents, ...current]);
    setIsCalendarConnected(true);
    window.localStorage.setItem(CALENDAR_KEY, "true");
    setSyncMessage("Agenda do Google sincronizada com sucesso.");
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-[#d4f5d4] px-3 py-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
                Bem-vindo
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Sua agenda clínica conectada ao Google.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Usuário: <span className="font-semibold text-slate-900">{userEmail}</span> · Login pelo Google: {provider === "google" ? "Sim" : "Não"}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <Link
                href="/"
                className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Voltar à home
              </Link>
              <span className="inline-flex rounded-2xl bg-[#90EE90] px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm">
                Agenda clínica ativa
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Google Calendar</p>
                  <p className="mt-2 text-slate-600">Sincronize seus compromissos do Google com a agenda do sistema.</p>
                </div>
                <span className="rounded-full bg-[#f4fff4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
                  {connectedLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={handleGoogleSync}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#90EE90] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#7ad47a] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSyncing}
              >
                {isSyncing ? "Sincronizando..." : provider === "google" ? "Sincronizar agenda do Google" : "Use login Google para conectar"}
              </button>
              {syncMessage ? <p className="mt-4 text-sm text-slate-600">{syncMessage}</p> : null}
            </div>

            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Nova consulta</p>
                  <p className="mt-2 text-slate-600">Adicione um atendimento rápido sem sair da agenda.</p>
                </div>
                <span className="rounded-full bg-[#f4fff4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
                  Local
                </span>
              </div>

              <form onSubmit={handleAddConsultation} className="mt-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    Paciente
                    <input
                      value={patient}
                      onChange={(event) => setPatient(event.target.value)}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    Serviço
                    <input
                      value={service}
                      onChange={(event) => setService(event.target.value)}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    Início
                    <input
                      type="datetime-local"
                      value={start}
                      onChange={(event) => setStart(event.target.value)}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    Fim
                    <input
                      type="datetime-local"
                      value={end}
                      onChange={(event) => setEnd(event.target.value)}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                    />
                  </label>
                </div>
                <label className="space-y-2 text-sm text-slate-700">
                  Valor (R$)
                  <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(event) => setValue(Number(event.target.value))}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#90EE90]"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#90EE90] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#7ad47a]"
                >
                  Salvar consulta
                </button>
              </form>
            </div>

            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Consultas salvas</p>
                  <p className="mt-2 text-slate-600">Use a agenda para reorganizar e acompanhar atendimentos.</p>
                </div>
                <span className="rounded-full bg-[#f4fff4] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#2d652d]">
                  {events.length} itens
                </span>
              </div>

              <div className="mt-6 space-y-3">
                {events.slice(0, 4).map((item) => (
                  <div key={String(item.id)} className="rounded-3xl border border-slate-200 bg-[#f8fff8] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{item.patient ?? "Paciente"}</p>
                        <p className="text-sm text-slate-600">{item.service ?? "Consulta médica"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveConsultation(String(item.id))}
                        className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300"
                      >
                        Excluir
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{item.start?.toString().replace("T", " ")}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">R$ {(item.value ?? 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-slate-950">Agenda</h2>
              <p className="text-sm text-slate-600">Arraste consultas, visualize horários e mantenha a agenda sincronizada com o Google.</p>
            </div>
            <div className="mt-6">
              <AgendaCalendar events={events} onEventsChange={setEvents} />
            </div>
            {upcomingAppointment ? (
              <div className="mt-8 rounded-3xl bg-[#f4fff4] p-6 text-slate-700">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2d652d]">Próximo compromisso</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{upcomingAppointment.title}</p>
                <p className="mt-1 text-sm">{upcomingAppointment.start?.toString().replace("T", " ")}</p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
