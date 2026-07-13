"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { EventInput } from "@fullcalendar/core";
import dynamic from "next/dynamic";
import AgendaPageGate from "@/components/AgendaPageGate";

const AgendaCalendar = dynamic(() => import("@/components/AgendaCalendar"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 min-h-[24rem] sm:min-h-[36rem] flex items-center justify-center text-slate-500">
      Carregando calendário...
    </div>
  ),
});
import {
  MapPin,
  ExternalLink,
  Loader2,
  Building2,
  CheckCircle2,
  MessageCircle,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import FinalizarConsultaModal from "@/components/FinalizarConsultaModal";
import { useClinicaTitular } from "@/lib/useClinicaTitular";
import AgendaConsultaModal, {
  type AgendaConsultaPayload,
} from "@/components/AgendaConsultaModal";
import { clientesApiToOpcoes } from "@/lib/pacienteOpcoesUi";
import type { PacienteOpcao } from "@/lib/types";
import AgendaNovaConsultaForm, {
  type AgendaNovaConsultaSubmitData,
} from "@/components/AgendaNovaConsultaForm";
import { isValidPhone } from "@/lib/phone";
import { useMedicosOptions } from "@/lib/useMedicosOptions";
import {
  resolveMedicoValue,
  profissionalIdByNome,
  profissionalHasAgendaConnected,
} from "@/lib/loadMedicosOptions";
import {
  type ConsultationRecord,
  type FormaPagamentoConsulta,
  loadConsultations,
  saveConsultations,
  setConsultationsStorageOwner,
  applyFinalizarConsulta,
  FORMAS_PAGAMENTO_CONSULTA,
  STATUS_CONSULTA_UI,
  TIPO_CONSULTA_UI,
  parseEventDate,
  createConsultationEvent,
  DURACAO_CONSULTA_MIN,
  consultationsListsEqual,
} from "@/lib/consultations";
import {
  scheduleSyncConsultasToServer,
  syncConsultaToServerImmediately,
  refreshConsultasFromServer,
  loadAndMergeConsultasFromServer,
  backfillObservacoesToServerIfNeeded,
  mergeGoogleCalendarEvents,
  syncGoogleImportToServer,
  dedupeConsultations,
  deleteConsultasFromServer,
  planConsultaRemoval,
  seedConsultasSyncSnapshot,
  trackImmediateConsultaSync,
  markConsultaPendingScheduleChange,
  markConsultaPendingMetadata,
  clearConsultaPendingServerConfirmation,
  patchConsultaTimeOnServer,
  consultaSchedulesMatch,
  consultaServerConfirmsLocal,
  recoverGoogleLinkFromEvents,
  isPendingLocalConsulta,
} from "@/lib/syncConsultasClient";
import {
  MSG_FINALIZAR_CLIENTE_FALHOU,
  MSG_FINANCEIRO_FALHOU,
  postFinalizarClienteFromAgenda,
  postFinanceiroEntradaFromAgenda,
} from "@/lib/finalizarClienteFromAgenda";
import { invalidateFinanceiroCache } from "@/lib/financeiroCache";
import { pushConsultaToGoogleCalendar } from "@/lib/agendaGooglePushClient";
import { medicoNomeChanged } from "@/lib/agendaGoogleProfissionalTransfer";
import { startConsultasRevisionPolling } from "@/lib/consultasRevisionPoll";
import { syncAgendaAuthoritative } from "@/lib/syncAllModulesClient";
import AgendaProfissionalFilter from "@/components/AgendaProfissionalFilter";
import {
  agendaProfFilterStorageKey,
  allProfFilterKeys,
  buildProfissionalFilterEntries,
  filterEventsByVisibleProfissionais,
  hasUnassignedProfissionalEvents,
  loadVisibleProfKeys,
  sanitizeVisibleKeys,
  saveVisibleProfKeys,
} from "@/lib/agendaProfissionalFilter";
import { format } from "date-fns";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { useToast } from "@/components/ToastProvider";

type ConsultationEvent = ConsultationRecord;

type AgendaPageClientProps = {
  userEmail: string;
  provider?: string | null;
};

const AGENDA_VISIBILITY_COOLDOWN_MS = 12_000;
const AGENDA_VISIBILITY_DEBOUNCE_MS = 800;
const AGENDA_BACKGROUND_REFRESH_MS = 4_000;

function scheduleMinuteMs(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000;
}

function sameScheduleForEdit(
  prev: ConsultationEvent,
  start: Date,
  end: Date,
): boolean {
  const prevStart = parseEventDate(prev.start)?.getTime();
  const prevEnd = parseEventDate(prev.end)?.getTime();
  if (prevStart == null || prevEnd == null) return false;
  return (
    scheduleMinuteMs(prevStart) === scheduleMinuteMs(start.getTime()) &&
    scheduleMinuteMs(prevEnd) === scheduleMinuteMs(end.getTime())
  );
}

/** Horário e médico iguais — só serviço, paciente, obs, etc. */
function isMetadataOnlyAgendaEdit(
  prev: ConsultationEvent | null | undefined,
  payload: AgendaConsultaPayload,
): boolean {
  if (!prev || !payload.editingId) return false;
  if (!sameScheduleForEdit(prev, payload.start, payload.end)) return false;
  const prevMed = prev.medico?.trim().toLowerCase() ?? "";
  const newMed = payload.medico?.trim().toLowerCase() ?? "";
  return prevMed === newMed;
}

export default function AgendaPageClient({
  userEmail,
  provider,
}: AgendaPageClientProps) {
  const toast = useToast();
  const [events, setEvents] = useState<ConsultationEvent[]>([]);
  const displayEvents = useMemo(() => dedupeConsultations(events), [events]);

  const [serverPullDone, setServerPullDone] = useState(false);
  const [refreshingServer, setRefreshingServer] = useState(false);

  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [finalizando, setFinalizando] = useState<ConsultationEvent | null>(null);
  const [savingFinalizar, setSavingFinalizar] = useState(false);
  const skipNextSave = useRef(true);
  const savingFromSelf = useRef(false);
  const eventsRef = useRef<ConsultationEvent[]>([]);
  eventsRef.current = events;
  const lastVisibilityRefreshRef = useRef(0);
  const lastHiddenAtRef = useRef<number | null>(null);
  const visibilityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const softRefreshSeqRef = useRef(0);
  const [agendaModal, setAgendaModal] = useState<{
    start: Date;
    end: Date;
    editing: ConsultationEvent | null;
  } | null>(null);
  const [savingAgendaModal, setSavingAgendaModal] = useState(false);
  const [deletingAgendaModal, setDeletingAgendaModal] = useState(false);
  const [whatsappConfirm, setWhatsappConfirm] = useState<{
    paciente: string;
    mensagem: string;
    whatsapp_url: string | null;
  } | null>(null);
  const [copiadoConfirm, setCopiadoConfirm] = useState(false);
  const [syncingAutoAgendamento, setSyncingAutoAgendamento] = useState(false);
  const [autoAgendamentoMsg, setAutoAgendamentoMsg] = useState<string | null>(null);
  const { medicos: medicosOptions, profissionais, isClinica, loading: medicosLoading } = useMedicosOptions();
  const clinicaTitular = useClinicaTitular();

  const profFilterEntries = useMemo(
    () => buildProfissionalFilterEntries(medicosOptions, profissionais),
    [medicosOptions, profissionais],
  );
  const showProfFilter = profFilterEntries.length > 0;
  const showUnassignedFilter = useMemo(
    () => hasUnassignedProfissionalEvents(displayEvents, profissionais),
    [displayEvents, profissionais],
  );
  const profFilterStorageKey = userEmail
    ? agendaProfFilterStorageKey(userEmail)
    : "";
  const [visibleProfKeys, setVisibleProfKeys] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!showProfFilter) return;
    const all = allProfFilterKeys(profFilterEntries, showUnassignedFilter);
    const saved = profFilterStorageKey
      ? loadVisibleProfKeys(profFilterStorageKey)
      : null;
    if (saved) {
      const sanitized = sanitizeVisibleKeys(saved, all);
      setVisibleProfKeys(sanitized.size > 0 ? sanitized : all);
    } else {
      setVisibleProfKeys(all);
    }
  }, [showProfFilter, profFilterEntries, showUnassignedFilter, profFilterStorageKey]);

  const handleVisibleProfChange = useCallback(
    (keys: Set<string>) => {
      setVisibleProfKeys(keys);
      if (profFilterStorageKey) saveVisibleProfKeys(profFilterStorageKey, keys);
    },
    [profFilterStorageKey],
  );

  const calendarEvents = useMemo(() => {
    if (!showProfFilter) return displayEvents;
    return filterEventsByVisibleProfissionais(
      displayEvents,
      visibleProfKeys,
      profissionais,
    );
  }, [showProfFilter, displayEvents, visibleProfKeys, profissionais]);

  const handleCalendarEventsChange = useCallback(
    (nextFromCalendar: ConsultationEvent[]) => {
      const merged = showProfFilter
        ? dedupeConsultations(
            events.map((item) => {
              const updated = nextFromCalendar.find(
                (ev) => String(ev.id) === String(item.id),
              );
              return updated ?? item;
            }),
          )
        : dedupeConsultations(nextFromCalendar);

      const pendingReschedules: {
        ev: ConsultationEvent;
        old: ConsultationEvent;
      }[] = [];

      for (const ev of merged) {
        const old = events.find((e) => String(e.id) === String(ev.id));
        if (!old) continue;
        const oldStart = parseEventDate(old.start)?.getTime();
        const oldEnd = parseEventDate(old.end)?.getTime();
        const newStart = parseEventDate(ev.start)?.getTime();
        const newEnd = parseEventDate(ev.end)?.getTime();
        if (oldStart === newStart && oldEnd === newEnd) continue;
        if (!parseEventDate(ev.start) || !parseEventDate(ev.end)) continue;
        pendingReschedules.push({ ev, old });
      }

      eventsRef.current = merged;
      setEvents(merged);

      for (const { ev, old } of pendingReschedules) {
        markConsultaPendingScheduleChange(ev);
        void (async () => {
          if (!isPendingLocalConsulta(ev)) {
            const patch = await patchConsultaTimeOnServer(ev);
            if (!patch.ok) {
              clearConsultaPendingServerConfirmation(ev);
              setEvents((current) =>
                current.map((item) =>
                  String(item.id) === String(ev.id) ? old : item,
                ),
              );
              setSyncMessage(patch.error);
              setSyncStatus("error");
              return;
            }
          }
          const sync = await syncConsultaToServerImmediately(ev);
          if (!sync.ok) {
            clearConsultaPendingServerConfirmation(ev);
            setEvents((current) =>
              current.map((item) =>
                String(item.id) === String(ev.id) ? old : item,
              ),
            );
            setSyncMessage(sync.error);
            setSyncStatus("error");
          }
        })();
      }
    },
    [events, showProfFilter],
  );

  const hasProfissionalAgendas = useMemo(
    () => profissionais.some((p) => p.agenda_google_status === "connected"),
    [profissionais],
  );

  const canUseGoogleCalendar = isGoogleConnected || hasProfissionalAgendas;

  const importarAutoagendamentos = useCallback(async () => {
    setSyncingAutoAgendamento(true);
    setAutoAgendamentoMsg(null);
    try {
      const res = await fetch('/api/clientes/sync-agendamentos', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao importar');
      const n = data.sincronizados ?? data.count ?? 0;
      setAutoAgendamentoMsg(
        n > 0
          ? `${n} autoagendamento(s) importado(s) para Clientes.`
          : 'Nenhum autoagendamento pendente.',
      );
      if (n > 0) {
        const local = loadConsultations(userEmail);
        const merged = await refreshConsultasFromServer(local);
        setEvents(merged);
        saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
      }
    } catch (err: unknown) {
      setAutoAgendamentoMsg(
        err instanceof Error ? err.message : 'Erro ao importar autoagendamentos',
      );
    } finally {
      setSyncingAutoAgendamento(false);
    }
  }, []);

  async function carregarConfirmacaoWhatsapp(ev: ConsultationEvent) {
    const start = parseEventDate(ev.start);
    if (!start || !ev.patient?.trim()) return;
    try {
      const res = await fetch("/api/consultas/confirmacao-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultaId: String(ev.id),
          paciente: ev.patient,
          telefone: ev.telefone,
          inicio: start.toISOString(),
          medico: ev.medico,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setWhatsappConfirm({
        paciente: ev.patient!,
        mensagem: data.mensagem,
        whatsapp_url: data.whatsapp_url,
      });
      setCopiadoConfirm(false);
    } catch {
      /* opcional */
    }
  }

  function resolveGoogleProfissionalId(medicoNome?: string): string | undefined {
    if (!medicoNome || !isClinica) return undefined;
    if (!profissionalHasAgendaConnected(profissionais, medicoNome)) return undefined;
    return profissionalIdByNome(profissionais, medicoNome);
  }
  const [clientesAgenda, setClientesAgenda] = useState<PacienteOpcao[]>([]);
  const [initialClienteId, setInitialClienteId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Perfil / endereço do consultório
  const [profile, setProfile] = useState<{
    full_name?: string;
    clinic_name?: string;
    specialty?: string;
    address?: string;
    street?: string;
    address_number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((data) => {
        if (data.clientes) {
          setClientesAgenda(clientesApiToOpcoes(data.clientes));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("agendar") !== "1") return;
    const clienteId = searchParams.get("clienteId");
    if (clienteId) setInitialClienteId(clienteId);
    const start = new Date();
    start.setSeconds(0, 0);
    const m = start.getMinutes();
    if (m > 0 && m <= 30) start.setMinutes(30);
    else if (m > 30) {
      start.setHours(start.getHours() + 1);
      start.setMinutes(0);
    }
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + DURACAO_CONSULTA_MIN);
    setAgendaModal({ start, end, editing: null });
    window.history.replaceState({}, "", "/agenda");
  }, [searchParams]);

  // Buscar perfil do usuário para exibir endereço
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/perfil");
        if (res.ok) {
          const data = await res.json();
          const p = data.profile || data;
          setProfile(p);
          setProfileError(false);
        } else {
          setProfileError(true);
        }
      } catch {
        setProfileError(true);
      } finally {
        setProfileLoading(false);
      }
    }
    fetchProfile();
  }, []);

  /** Monta endereço formatado a partir dos campos estruturados do perfil */
  const enderecoFormatado = useMemo(() => {
    if (!profile) return "";
    const partes: string[] = [];
    if (profile.street) {
      let rua = profile.street;
      if (profile.address_number) rua += `, ${profile.address_number}`;
      partes.push(rua);
    }
    if (profile.complement) partes.push(profile.complement);
    if (profile.neighborhood) partes.push(profile.neighborhood);
    const cidadeEstado: string[] = [];
    if (profile.city) cidadeEstado.push(profile.city);
    if (profile.state) cidadeEstado.push(profile.state);
    if (cidadeEstado.length > 0) partes.push(cidadeEstado.join("/"));
    if (profile.cep) partes.push(`CEP: ${profile.cep}`);
    // Fallback para o campo address antigo
    if (partes.length === 0 && profile.address) partes.push(profile.address);
    return partes.join(", ");
  }, [profile]);

  /** Gera link do Google Maps para o endereço */
  const googleMapsLink = useMemo(() => {
    const addr = enderecoFormatado;
    if (!addr) return "";
    return `https://www.google.com/maps/search/${encodeURIComponent(addr)}`;
  }, [enderecoFormatado]);

  /** Nome do profissional/clínica para exibir */
  const nomeProfissional = useMemo(() => {
    if (!profile) return "";
    return profile.clinic_name || profile.full_name || "";
  }, [profile]);

  /** Especialidade do profissional */
  const especialidade = useMemo(() => {
    if (!profile) return "";
    return profile.specialty || "";
  }, [profile]);

  // Conectar Google Calendar via autorização incremental
  function handleConnectCalendar() {
    setIsAuthorizing(true);
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/auth/google-authorize?scope=calendar&redirect=${redirect}`;
  }

  // Verificar se autorização foi concluída (via URL param)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'calendar') {
      setIsGoogleConnected(true);
      // Limpar param da URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Verificar conexão com Google Calendar via sessão (token já pode estar na sessão)
  useEffect(() => {
    async function checkSessionConnection() {
      // Se já está conectado via URL param, não precisa verificar
      if (isGoogleConnected) return;
      try {
        // Tentar chamada leve para ver se o token já está disponível na sessão
        const res = await fetch("/api/google-calendar?maxResults=1");
        if (res.ok) {
          setIsGoogleConnected(true);
          return;
        }
        const allRes = await fetch("/api/google-calendar?allConnected=true&maxResults=1");
        if (allRes.ok) setIsGoogleConnected(true);
      } catch {
        // Silencioso - não conectado ainda
      }
    }
    checkSessionConnection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    setConsultationsStorageOwner(userEmail);
  }, [userEmail]);

  useEffect(() => {
    let cancelled = false;

    const local = loadConsultations(userEmail);
    setEvents(local);
    skipNextSave.current = false;

    void (async () => {
      try {
        await backfillObservacoesToServerIfNeeded();
        const merged = dedupeConsultations(await loadAndMergeConsultasFromServer(local));
        if (!cancelled) {
          skipNextSave.current = true;
          setEvents(merged);
          saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
          seedConsultasSyncSnapshot(merged);
          skipNextSave.current = false;
          setServerPullDone(true);
        }
      } catch {
        if (!cancelled) setServerPullDone(true);
      }
    })();

    const handler = () => {
      if (savingFromSelf.current) return;
      const next = loadConsultations(userEmail);
      setEvents((prev) => {
        if (consultationsListsEqual(prev, next)) return prev;
        return next;
      });
    };

    window.addEventListener("medsupapp-consultations-updated", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("medsupapp-consultations-updated", handler);
    };
  }, [userEmail]);

  const pullFromServer = useCallback(async () => {
    setRefreshingServer(true);
    try {
      if (!userEmail) return;
      const { events: merged } = await syncAgendaAuthoritative(userEmail);
      const deduped = dedupeConsultations(merged);
      skipNextSave.current = true;
      setEvents(deduped);
      saveConsultations(deduped, { broadcast: false, ownerEmail: userEmail });
      skipNextSave.current = false;
    } catch {
      /* best-effort */
    } finally {
      setRefreshingServer(false);
    }
  }, [userEmail]);

  const refreshAgendaData = useCallback(async () => {
    setSyncMessage(null);
    try {
      await pullFromServer();
      if (canUseGoogleCalendar) {
        await handleGoogleSync();
      }
      setSyncMessage("Agenda sincronizada com os outros dispositivos.");
      setSyncStatus("success");
    } catch {
      setSyncMessage("Não foi possível sincronizar. Tente novamente.");
      setSyncStatus("error");
    }
  }, [pullFromServer, canUseGoogleCalendar]); // eslint-disable-line react-hooks/exhaustive-deps

  const softRefreshOnVisible = useCallback(async () => {
    if (!userEmail) return;
    const now = Date.now();
    const hiddenAt = lastHiddenAtRef.current;
    const backgroundMs = hiddenAt != null ? now - hiddenAt : AGENDA_BACKGROUND_REFRESH_MS;
    if (
      backgroundMs < AGENDA_BACKGROUND_REFRESH_MS &&
      now - lastVisibilityRefreshRef.current < AGENDA_VISIBILITY_COOLDOWN_MS
    ) {
      return;
    }

    const seq = ++softRefreshSeqRef.current;
    try {
      const local = loadConsultations(userEmail);
      const merged = await refreshConsultasFromServer(local);
      if (seq !== softRefreshSeqRef.current) return;
      if (!consultationsListsEqual(local, merged)) {
        skipNextSave.current = true;
        setEvents(merged);
        saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
        seedConsultasSyncSnapshot(merged);
        skipNextSave.current = false;
      }
      lastVisibilityRefreshRef.current = Date.now();
      lastHiddenAtRef.current = null;
    } catch {
      /* best-effort */
    }
  }, [userEmail]);

  useEffect(() => {
    if (!serverPullDone) return;

    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
      }
    };

    const scheduleSoftRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current);
      visibilityDebounceRef.current = setTimeout(() => {
        visibilityDebounceRef.current = null;
        void softRefreshOnVisible();
      }, AGENDA_VISIBILITY_DEBOUNCE_MS);
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) scheduleSoftRefresh();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key?.includes('consultations')) scheduleSoftRefresh();
    };

    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener("focus", scheduleSoftRefresh);
    document.addEventListener("visibilitychange", scheduleSoftRefresh);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('storage', onStorage);
    return () => {
      if (visibilityDebounceRef.current) clearTimeout(visibilityDebounceRef.current);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener("focus", scheduleSoftRefresh);
      document.removeEventListener("visibilitychange", scheduleSoftRefresh);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('storage', onStorage);
    };
  }, [serverPullDone, softRefreshOnVisible]);

  useEffect(() => {
    if (!serverPullDone || !userEmail) return;
    return startConsultasRevisionPolling({
      ownerEmail: userEmail,
      onApply: (merged) => {
        skipNextSave.current = true;
        setEvents(merged);
        skipNextSave.current = false;
      },
    });
  }, [serverPullDone, userEmail]);

  useEffect(() => {
    if (!serverPullDone || !userEmail) return;

    const pullWhileOpen = () => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const local = loadConsultations(userEmail);
          const merged = await refreshConsultasFromServer(local);
          if (!consultationsListsEqual(local, merged)) {
            skipNextSave.current = true;
            setEvents(merged);
            saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
            skipNextSave.current = false;
          }
        } catch {
          /* best-effort */
        }
      })();
    };

    const id = window.setInterval(pullWhileOpen, 60_000);
    return () => window.clearInterval(id);
  }, [serverPullDone, userEmail]);

  useEffect(() => {
    if (skipNextSave.current) return;
    savingFromSelf.current = true;
    const deduped = dedupeConsultations(events);
    if (deduped.length !== events.length) {
      skipNextSave.current = true;
      setEvents(deduped);
      skipNextSave.current = false;
      savingFromSelf.current = false;
      return;
    }
    saveConsultations(deduped, { ownerEmail: userEmail });
    scheduleSyncConsultasToServer(deduped);
    savingFromSelf.current = false;
  }, [events]);

  const handleSlotSelect = useCallback((start: Date, end: Date) => {
    setAgendaModal({ start, end, editing: null });
  }, []);

  const handleCalendarEventClick = useCallback((ev: ConsultationEvent) => {
    const startDate = parseEventDate(ev.start) ?? new Date();
    const endDate =
      parseEventDate(ev.end) ??
      (() => {
        const f = new Date(startDate);
        f.setMinutes(f.getMinutes() + 40);
        return f;
      })();
    setAgendaModal({ start: startDate, end: endDate, editing: ev });
  }, []);

  async function confirmAgendaConsulta(payload: AgendaConsultaPayload): Promise<string | void> {
    setSavingAgendaModal(true);
    const isCreate = !payload.editingId;
    const others = payload.editingId
      ? events.filter((e) => String(e.id) !== String(payload.editingId))
      : events;

    const prev = payload.editingId
      ? events.find((e) => String(e.id) === String(payload.editingId))
      : null;

    const localEvent: ConsultationEvent = {
      ...createConsultationEvent({
        id: payload.editingId ?? undefined,
        patient: payload.patient,
        service: payload.service,
        value: payload.value,
        start: payload.start,
        end: payload.end,
        location: payload.location || enderecoFormatado || undefined,
        telefone: payload.telefone || undefined,
        lembretesWhatsapp: payload.lembretesWhatsapp,
        medico: payload.medico || undefined,
        convenio: payload.convenio || undefined,
        observacoes: payload.observacoes || undefined,
        isDraft: false,
        allEvents: others,
        clienteDriveId: payload.clienteDriveId ?? null,
        tipoConsulta: payload.tipoConsulta,
      }),
      ...(prev
        ? {
            googleEventId: prev.googleEventId,
            googleProfissionalId: prev.googleProfissionalId,
            status: prev.status,
            payment: prev.payment,
          }
        : {}),
    };

    if (!prev) {
      trackImmediateConsultaSync(String(localEvent.id));
    } else if (!isMetadataOnlyAgendaEdit(prev, payload)) {
      markConsultaPendingScheduleChange(localEvent);
    } else {
      markConsultaPendingMetadata(localEvent);
    }

    const merged = dedupeConsultations(
      payload.editingId
        ? [localEvent, ...events.filter((e) => String(e.id) !== String(payload.editingId))]
        : [localEvent, ...events],
    );
    eventsRef.current = merged;
    skipNextSave.current = true;
    setEvents(merged);
    skipNextSave.current = false;

    let syncedEvent = localEvent;

    const profissionalChanged = medicoNomeChanged(
      prev?.medico,
      payload.medico || localEvent.medico,
    );

    if (
      !isMetadataOnlyAgendaEdit(prev, payload) &&
      !isPendingLocalConsulta(localEvent) &&
      !profissionalChanged
    ) {
      const patchResult = await patchConsultaTimeOnServer(localEvent);
      if (!patchResult.ok) {
        if (prev) {
          setEvents((current) =>
            current.map((e) =>
              String(e.id) === String(localEvent.id) ? prev : e,
            ),
          );
        }
        clearConsultaPendingServerConfirmation(localEvent);
        throw new Error(patchResult.error);
      }
    }

    if (canUseGoogleCalendar) {
      const profId = resolveGoogleProfissionalId(payload.medico || localEvent.medico);
      if (profId || isGoogleConnected) {
        const recovered = recoverGoogleLinkFromEvents(
          localEvent,
          eventsRef.current,
        );
        const googleResult = await pushConsultaToGoogleCalendar(localEvent, {
          patient: payload.patient,
          start: payload.start,
          end: payload.end,
          location: payload.location,
          medico: payload.medico || localEvent.medico,
          previousMedico: prev?.medico,
          metadataOnly: isMetadataOnlyAgendaEdit(prev, payload),
          recoveredGoogleEventId: recovered.googleEventId
            ? String(recovered.googleEventId)
            : undefined,
          recoveredGoogleProfissionalId: recovered.googleProfissionalId,
          resolveProfissionalId: resolveGoogleProfissionalId,
        });
        if (googleResult.error) {
          console.warn('[agenda] Google Calendar:', googleResult.error);
        } else {
          syncedEvent = googleResult.event;
          setEvents((current) =>
            current.map((e) =>
              String(e.id) === String(localEvent.id) ? syncedEvent : e,
            ),
          );
        }
      }
    }

    scheduleSyncConsultasToServer([
      syncedEvent,
      ...events.filter((e) => String(e.id) !== String(localEvent.id)),
    ]);
    const syncResult = await syncConsultaToServerImmediately(syncedEvent);
    if (!syncResult.ok) {
      if (prev) {
        setEvents((current) =>
          current.map((e) =>
            String(e.id) === String(localEvent.id) ? prev : e,
          ),
        );
      }
      clearConsultaPendingServerConfirmation(localEvent);
      throw new Error(syncResult.error);
    }

    try {
      const serverEvents = await refreshConsultasFromServer(merged);
      const serverEv = serverEvents.find(
        (s) => String(s.id) === String(syncedEvent.id),
      );
      if (serverEv && consultaServerConfirmsLocal(syncedEvent, serverEv)) {
        clearConsultaPendingServerConfirmation(syncedEvent);
      }
    } catch {
      /* poll confirmará depois */
    }

    if (syncedEvent.telefone && isValidPhone(syncedEvent.telefone)) {
      void carregarConfirmacaoWhatsapp(syncedEvent);
    }

    void reloadClientesAgenda();
    setSavingAgendaModal(false);

    if (isCreate) {
      return String(localEvent.id);
    }

    setAgendaModal(null);
  }

  // Google Calendar: sincronizar apenas pelo botão "Sincronizar" (não ao montar).

  // Totalizadores
  const totalRevenue = useMemo(
    () => events.reduce((sum, item) => sum + Number(item.value ?? 0), 0),
    [events],
  );
  const googleEventsCount = useMemo(
    () => events.filter((e) => e.googleEventId).length,
    [events],
  );

  const connectedLabel = canUseGoogleCalendar
    ? hasProfissionalAgendas && !isGoogleConnected
      ? "Equipe conectada"
      : "Conectado"
    : "Não conectado";

  /** Sincronizar: puxa eventos do Google Calendar e mescla com locais */
  async function handleGoogleSync() {
    if (!canUseGoogleCalendar) {
      setSyncMessage(
        "Conecte sua agenda Google ou peça aos médicos que autorizem pelo link de convite.",
      );
      setSyncStatus("error");
      return;
    }

    setIsSyncing(true);
    setSyncStatus("loading");
    setSyncMessage(null);

    try {
      const syncUrl =
        isClinica && hasProfissionalAgendas
          ? "/api/google-calendar?allConnected=true"
          : "/api/google-calendar";
      const res = await fetch(syncUrl);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          err.error || "Falha ao sincronizar com Google Calendar.",
        );
      }

      const data = await res.json();
      const googleEvents: ConsultationEvent[] = (data.items || []).map(
        (item: {
          id: string;
          summary?: string;
          attendees?: { email?: string }[];
          creator?: { email?: string };
          location?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
          _profissionalId?: string;
        }) => ({
          id: `google-${item.id}`,
          googleEventId: item.id,
          googleProfissionalId: item._profissionalId,
          title: item.summary || "Evento Google",
          patient: item.attendees?.[0]?.email || item.creator?.email || "Google",
          service: item.summary || "Evento de agenda",
          value: 0,
          location: item.location || undefined,
          start: item.start?.dateTime || item.start?.date || "",
          end: item.end?.dateTime || item.end?.date || "",
          backgroundColor: "#4285F4",
          borderColor: "#1a73e8",
        }),
      );

      // Mesclar, persistir no Supabase e reconciliar ids (evita sumir no poll)
      const current = loadConsultations(userEmail);
      const merged = mergeGoogleCalendarEvents(current, googleEvents);
      skipNextSave.current = true;
      setEvents(merged);
            saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
      skipNextSave.current = false;

      await syncGoogleImportToServer(merged, googleEvents);

      const reconciled = await refreshConsultasFromServer(merged);
      if (!consultationsListsEqual(merged, reconciled)) {
        skipNextSave.current = true;
        setEvents(reconciled);
        saveConsultations(reconciled, { broadcast: false, ownerEmail: userEmail });
        seedConsultasSyncSnapshot(reconciled);
        skipNextSave.current = false;
      }

      setSyncMessage(
        `${googleEvents.length} eventos sincronizados do Google Calendar.`,
      );
      setSyncStatus("success");
    } catch (err: any) {
      setSyncMessage(err.message);
      setSyncStatus("error");
    } finally {
      setIsSyncing(false);
    }
  }

  /** Criar consulta local + enviar para Google Calendar */
  const reloadClientesAgenda = useCallback(async () => {
    try {
      const res = await fetch("/api/clientes");
      const data = await res.json();
      if (data.clientes) setClientesAgenda(clientesApiToOpcoes(data.clientes));
    } catch {
      /* ignore */
    }
  }, []);

  /** Só cria evento local + sync — formulário isolado em AgendaNovaConsultaForm. */
  async function handleNovaConsultaSubmit(data: AgendaNovaConsultaSubmitData) {
    const localEvent = createConsultationEvent({
      patient: data.patientName,
      service: data.service,
      value: data.value,
      start: data.start,
      end: data.end,
      location: data.location || enderecoFormatado || undefined,
      telefone: data.telefone || undefined,
      lembretesWhatsapp: data.lembretesWhatsapp,
      medico: data.medicoNome || undefined,
      convenio: data.convenio || undefined,
      observacoes: data.observacoes || undefined,
      isDraft: false,
      allEvents: events,
    });

    trackImmediateConsultaSync(String(localEvent.id));
    setEvents((current) => dedupeConsultations([localEvent, ...current]));

    let syncedEvent = localEvent;

    if (canUseGoogleCalendar) {
      const medicoNome = data.medicoNome;
      const profId = resolveGoogleProfissionalId(medicoNome);
      if (profId || isGoogleConnected) {
        try {
          const googleResult = await pushConsultaToGoogleCalendar(localEvent, {
            patient: data.patientName,
            start: data.start,
            end: data.end,
            location: data.location || undefined,
            medico: medicoNome,
            resolveProfissionalId: resolveGoogleProfissionalId,
          });
          if (googleResult.error) {
            console.warn('[agenda] Google Calendar:', googleResult.error);
          } else if (googleResult.event.googleEventId) {
            syncedEvent = googleResult.event;
            setEvents((current) =>
              current.map((ev) =>
                String(ev.id) === String(localEvent.id) ? syncedEvent : ev,
              ),
            );
            setSyncMessage('Evento criado no Google Calendar com lembretes!');
            setSyncStatus('success');
          }
        } catch (err) {
          console.warn('Erro ao criar evento no Google:', err);
        }
      }
    }

    await syncConsultaToServerImmediately(syncedEvent);

    if (syncedEvent.telefone && isValidPhone(syncedEvent.telefone)) {
      void carregarConfirmacaoWhatsapp(syncedEvent);
    }
  }

  async function handleDeleteAgendaModal() {
    if (!agendaModal?.editing) return;
    if (!confirm("Excluir este agendamento da agenda?")) return;
    setDeletingAgendaModal(true);
    try {
      const removed = await handleRemoveConsultation(agendaModal.editing);
      if (!removed) return;
      setAgendaModal(null);
      setInitialClienteId(null);
    } finally {
      setDeletingAgendaModal(false);
    }
  }

  /** Remover consulta de forma otimista: UI primeiro; Supabase + Google em background. */
  async function handleRemoveConsultation(event: ConsultationEvent): Promise<boolean> {
    const plan = planConsultaRemoval(event, events);
    const idSet = new Set(plan.idsToDelete);
    const previousEvents = events;

    const next = dedupeConsultations(
      events.filter((item) => !idSet.has(String(item.id))),
    );
    skipNextSave.current = true;
    setEvents(next);
    saveConsultations(next, { broadcast: false, ownerEmail: userEmail });
    seedConsultasSyncSnapshot(next);
    skipNextSave.current = false;

    void (async () => {
      const delResult = await deleteConsultasFromServer({
        ids: plan.idsToDelete,
        googleEventIds: plan.googleEventId ? [plan.googleEventId] : undefined,
      });
      if (!delResult.ok) {
        skipNextSave.current = true;
        setEvents(previousEvents);
        saveConsultations(previousEvents, {
          broadcast: false,
          ownerEmail: userEmail,
        });
        seedConsultasSyncSnapshot(previousEvents);
        skipNextSave.current = false;
        toast.error(
          delResult.error?.trim() ||
            "Não foi possível excluir o agendamento. Ele foi restaurado na agenda.",
        );
        return;
      }

      if (plan.googleEventId && canUseGoogleCalendar) {
        try {
          const qs = new URLSearchParams({ eventId: plan.googleEventId });
          if (plan.googleProfissionalId) {
            qs.set("medicoId", plan.googleProfissionalId);
          }
          const googleRes = await fetchWithTimeout(
            `/api/google-calendar?${qs}`,
            { method: "DELETE" },
            20_000,
          );
          if (
            !googleRes.ok &&
            googleRes.status !== 404 &&
            googleRes.status !== 410
          ) {
            console.warn(
              "Google Calendar: exclusão incompleta",
              googleRes.status,
            );
          }
        } catch (err) {
          console.warn("Erro ao remover evento do Google Calendar:", err);
        }
      }
    })();

    return true;
  }

  /** Formatar moeda */
  const fmt = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;

  async function handleFinalizarConsulta(payload: {
    valorPago: number;
    valorOriginal: number;
    formaPagamento: FormaPagamentoConsulta;
    convenio: string;
    descontoPercent: number;
    descontoValor: number;
    parcelas: number;
    tipoConsulta: "nova_consulta" | "retorno";
    medico: string;
    percentualProfissional: number;
  }) {
    if (!finalizando?.id) return;
    setSavingFinalizar(true);

    const formaLabel =
      FORMAS_PAGAMENTO_CONSULTA.find((f) => f.id === payload.formaPagamento)?.label ??
      payload.formaPagamento;
    const tipoLabel =
      TIPO_CONSULTA_UI[payload.tipoConsulta]?.label ?? 'Novo atendimento';
    const paciente = finalizando.patient ?? "Paciente";

    const updated = applyFinalizarConsulta(events, finalizando.id, payload);
    const finalizedEvent = updated.find(
      (e) => String(e.id) === String(finalizando.id),
    );
    setEvents(updated);
    setFinalizando(null);

    const dataConsulta = parseEventDate(finalizando.start);
    const dataFinanceiro = dataConsulta
      ? format(dataConsulta, "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd");
    const horaConsulta = dataConsulta ? format(dataConsulta, "HH:mm") : null;

    if (finalizedEvent) {
      void syncConsultaToServerImmediately(finalizedEvent);
    }

    try {
      const descParts = [
        tipoLabel,
        paciente,
        formaLabel,
        payload.convenio ? `Convênio: ${payload.convenio}` : null,
        payload.parcelas > 1 ? `${payload.parcelas}x` : null,
      ].filter(Boolean);

      if (clinicaTitular !== false) {
        const pagamentoObs = `Pagamento: ${formaLabel}${payload.parcelas > 1 ? ` (${payload.parcelas}x)` : ""}`;
        const financeiroRes = await postFinanceiroEntradaFromAgenda({
          descricao: descParts.join(" - "),
          data: dataFinanceiro,
          valor: payload.valorPago,
          medico: payload.medico,
          forma_pagamento: payload.formaPagamento,
          parcelas: payload.parcelas,
          percentual_profissional: payload.percentualProfissional,
          observacao: pagamentoObs,
        });
        if (financeiroRes.ok) {
          if (userEmail) invalidateFinanceiroCache(userEmail);
        } else {
          window.alert(`${MSG_FINANCEIRO_FALHOU}\n\n${financeiroRes.error}`);
        }
      }
    } catch {
      if (clinicaTitular !== false) {
        window.alert(MSG_FINANCEIRO_FALHOU);
      }
    }

    const clienteDriveId =
      finalizedEvent?.clienteDriveId ?? finalizando.clienteDriveId ?? null;
    if (clienteDriveId) {
      const tipoAtendimento =
        payload.tipoConsulta === "retorno" ? "retorno" : "consulta";
      const clienteRes = await postFinalizarClienteFromAgenda(clienteDriveId, {
        data: dataFinanceiro,
        hora: horaConsulta,
        valor: payload.valorOriginal,
        valorOriginal: payload.valorOriginal,
        descontoPercent: payload.descontoPercent,
        descontoValor: payload.descontoValor,
        forma_pagamento: payload.formaPagamento,
        medico: payload.medico,
        parcelas: payload.parcelas,
        tipo: tipoAtendimento,
        plano: payload.convenio || null,
        observacoes: null,
      });
      if (!clienteRes.ok) {
        window.alert(`${MSG_FINALIZAR_CLIENTE_FALHOU}\n\n${clienteRes.error}`);
      }
    }

    setSavingFinalizar(false);
  }

  const overlayOpen = !!agendaModal || !!finalizando;

  return (
    <AgendaPageGate
      userEmail={userEmail}
      medicosLoading={medicosLoading}
      profissionais={profissionais}
      isClinica={isClinica}
    >
    <main className="min-h-screen bg-[#f8f9fa] pb-20 md:pb-12">
      <div
        className={`mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8 min-w-0 ${
          overlayOpen ? "hidden" : ""
        }`}
      >
        {/* Cabeçalho */}
        <div className="mb-4 sm:mb-8 rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-8 shadow-sm" data-tour="agenda-header">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs sm:text-sm font-semibold uppercase tracking-wide text-emerald-800">
                Agenda
              </p>
              <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                Sua agenda clínica conectada ao Google.
              </h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-lg leading-relaxed text-slate-600 break-words">
                <span className="block sm:inline">
                  <span className="font-semibold text-slate-900">{userEmail}</span>
                </span>
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline mt-1 sm:mt-0">
                  Google Calendar:{" "}
                  <span
                    className={`font-semibold ${
                      canUseGoogleCalendar ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    {connectedLabel}
                  </span>
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:gap-3 sm:items-end shrink-0">
              <Link
                href="/dashboard"
                className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Dashboard
              </Link>
              <span className="inline-flex rounded-2xl bg-emerald-200 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm">
                {googleEventsCount} no Google · {displayEvents.length} total
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,380px)_1fr] min-w-0">
          {/* Calendário primeiro no celular — content-visibility alivia scroll/paint no mobile */}
          <section
            className="order-1 xl:order-2 min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_28rem]"
            data-tour="agenda-calendar"
          >
            <div className="mb-3 sm:mb-4 px-0.5 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-slate-950">Grade da agenda</h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  Toque em um horário para agendar · no celular use a vista &quot;Dia&quot;
                </p>
              </div>
              <button
                type="button"
                data-tour="agenda-sincronizar"
                onClick={() => void refreshAgendaData()}
                disabled={refreshingServer || isSyncing || !serverPullDone}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/30 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50 touch-manipulation"
              >
                {refreshingServer || isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Sincronizar
              </button>
            </div>
            <AgendaCalendar
              events={calendarEvents}
              onEventsChange={handleCalendarEventsChange}
              onSlotSelect={handleSlotSelect}
              onEventClick={handleCalendarEventClick}
            />
          </section>

          {/* Formulários e cards — abaixo do calendário no mobile */}
          <aside className="order-2 xl:order-1 space-y-4 min-w-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-tour="agenda-autoimport">
              <p className="text-sm font-semibold text-slate-900">Autoagendamento online</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Importa reservas feitas pelo link público para a lista de Clientes e agenda.
              </p>
              <button
                type="button"
                onClick={() => void importarAutoagendamentos()}
                disabled={syncingAutoAgendamento}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${syncingAutoAgendamento ? 'animate-spin' : ''}`}
                />
                {syncingAutoAgendamento ? 'Importando...' : 'Importar autoagendamentos'}
              </button>
              {autoAgendamentoMsg && (
                <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                  {autoAgendamentoMsg}
                </p>
              )}
            </div>
            {whatsappConfirm && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-emerald-800">
                  Enviar confirmação ao paciente
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {whatsappConfirm.paciente} — mensagem com data da consulta e link para adicionar ao
                  calendário.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {whatsappConfirm.whatsapp_url && (
                    <a
                      href={whatsappConfirm.whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1da851]"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(whatsappConfirm.mensagem);
                      setCopiadoConfirm(true);
                      setTimeout(() => setCopiadoConfirm(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copiadoConfirm ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copiar mensagem
                  </button>
                  <button
                    type="button"
                    onClick={() => setWhatsappConfirm(null)}
                    className="text-xs text-slate-500 hover:text-slate-700 px-2"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}

            {showProfFilter && (
              <AgendaProfissionalFilter
                entries={profFilterEntries}
                visibleKeys={visibleProfKeys}
                onChange={handleVisibleProfChange}
                showUnassigned={showUnassignedFilter}
                accent="emerald"
              />
            )}

            <AgendaNovaConsultaForm
              clientesIniciais={clientesAgenda}
              medicosOptions={medicosOptions}
              isClinica={isClinica}
              defaultLocation={enderecoFormatado}
              isGoogleConnected={isGoogleConnected}
              onReloadClientes={reloadClientesAgenda}
              onSubmitConsulta={handleNovaConsultaSubmit}
            />

            {/* Card Endereço do Consultório */}
            <div className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-emerald-800">
                    {profileLoading ? "Carregando..." : "Consultório"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {profileLoading
                      ? "Buscando endereço..."
                      : profileError
                        ? "Endereço não configurado."
                        : "Endereço profissional cadastrado."}
                  </p>
                </div>
                <Building2 className="h-6 w-6 text-slate-400" />
              </div>

              {profileLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando dados do perfil...
                </div>
              ) : profile && enderecoFormatado ? (
                <div className="mt-4 space-y-3">
                  {nomeProfissional && (
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{nomeProfissional}</p>
                      {especialidade && (
                        <p className="text-xs text-slate-500">{especialidade}</p>
                      )}
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p className="text-sm text-slate-700">{enderecoFormatado}</p>
                  </div>
                  <a
                    href={googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir no Google Maps
                  </a>
                </div>
              ) : (
                <div className="mt-4">
                  <Link
                    href="/dashboard/perfil"
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Configurar endereço
                  </Link>
                </div>
              )}
            </div>

            {/* Card Google Calendar */}
            <div className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-emerald-800">
                    Google Calendar
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {isGoogleConnected
                      ? "Eventos sincronizados bidirecionalmente com lembretes automáticos."
                      : "Faça login com Google para ativar a sincronização."}
                  </p>
                </div>
                <span
                  className={`self-start shrink-0 rounded-full px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${
                    isGoogleConnected
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {connectedLabel}
                </span>
              </div>

              <button
                type="button"
                onClick={
                  isGoogleConnected
                    ? handleGoogleSync
                    : handleConnectCalendar
                }
                disabled={isSyncing || isAuthorizing}
                className="mt-4 sm:mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4285F4] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#3367d6] disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
              >
                {isSyncing || isAuthorizing ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {isSyncing ? "Sincronizando..." : "Redirecionando..."}
                  </>
                ) : isGoogleConnected ? (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sincronizar Google Calendar
                  </>
                ) : (
                  "Conectar Google Calendar"
                )}
              </button>

              {syncMessage && (
                <p
                  className={`mt-4 rounded-xl p-3 text-sm ${
                    syncStatus === "error"
                      ? "bg-red-50 text-red-600"
                      : syncStatus === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {syncMessage}
                </p>
              )}

              {isGoogleConnected && (
                <div className="mt-4 rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-medium text-blue-700">
                    🔔 Lembretes automáticos
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-blue-600">
                    <li>• 7 dias antes do evento</li>
                    <li>• 1 dia antes do evento</li>
                    <li>• 1 hora antes do evento</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Card Consultas salvas */}
            <div className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-emerald-800">
                    Consultas salvas
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Receita total: {fmt(totalRevenue)}
                  </p>
                </div>
                <span className="self-start shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  {events.length} itens
                </span>
              </div>

              <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto">
                {events.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Nenhuma consulta registrada.
                  </p>
                ) : (
                  events.slice(0, 6).map((item) => {
                    const st =
                      STATUS_CONSULTA_UI[item.status ?? "confirmado"] ??
                      STATUS_CONSULTA_UI.confirmado;
                    const tipo =
                      item.tipoConsulta && TIPO_CONSULTA_UI[item.tipoConsulta];
                    const podeFinalizar =
                      item.status !== "realizado" &&
                      item.status !== "cancelado" &&
                      item.status !== "faltou";

                    return (
                    <div
                      key={String(item.id)}
                      className="rounded-3xl border border-slate-200 bg-emerald-50 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {item.patient ?? "Paciente"}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {tipo && (
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipo.color}`}
                              >
                                {tipo.label}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}
                            >
                              {st.label}
                            </span>
                          </div>
                          <p className="truncate text-sm text-slate-600 mt-0.5">
                            {item.service ?? "Consulta médica"}
                          </p>
                          {item.googleEventId && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                              <svg
                                className="h-3 w-3"
                                viewBox="0 0 24 24"
                                fill="#4285F4"
                              >
                                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                              </svg>
                              Google
                            </span>
                          )}
                        </div>
                        <div className="flex flex-row flex-wrap gap-2 sm:shrink-0 sm:flex-col sm:items-end">
                          {podeFinalizar && (
                            <button
                              type="button"
                              disabled={savingFinalizar}
                              onClick={() => setFinalizando(item)}
                              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-full bg-emerald-700 px-3 py-2 sm:py-1 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50 touch-manipulation"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Finalizar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveConsultation(item)}
                            className="inline-flex flex-1 sm:flex-none items-center justify-center rounded-full bg-red-50 px-3 py-2 sm:py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 touch-manipulation"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        {item.start?.toString().replace("T", " ").slice(0, 16)}
                      </p>
                      {item.location && (
                        <p className="mt-1 truncate text-xs text-blue-500">
                          📍 {item.location}
                        </p>
                      )}
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {item.status === "realizado" && item.payment
                          ? fmt(item.payment.valorPago)
                          : fmt(item.value ?? 0)}
                      </p>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {agendaModal && (
        <AgendaConsultaModal
          open
          slotStart={agendaModal.start}
          slotEnd={agendaModal.end}
          editingEvent={agendaModal.editing}
          allEvents={events}
          isClinica={isClinica}
          medicos={medicosOptions}
          defaultLocation={enderecoFormatado}
          saving={savingAgendaModal}
          clientesIniciais={clientesAgenda}
          initialClienteId={initialClienteId}
          onClose={() => {
            setAgendaModal(null);
            setInitialClienteId(null);
          }}
          onConfirm={confirmAgendaConsulta}
          onDelete={
            agendaModal.editing
              ? () => void handleDeleteAgendaModal()
              : undefined
          }
          deleting={deletingAgendaModal}
        />
      )}

      {finalizando && (
        <FinalizarConsultaModal
          consulta={finalizando}
          allEvents={events}
          medicos={medicosOptions}
          isClinica={isClinica}
          onClose={() => setFinalizando(null)}
          onConfirm={handleFinalizarConsulta}
        />
      )}
    </main>
    </AgendaPageGate>
  );
}
