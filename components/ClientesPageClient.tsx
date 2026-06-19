"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  FileText,
  Calendar,
  MessageSquare,
  Wallet,
  Trash2,
  Pencil,
  Loader2,
  X,
  Link2,
  Cloud,
  MessageCircle,
  RefreshCw,
  CheckCircle2,
  Contact,
  CalendarPlus,
  Lock,
  GitMerge,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import FinalizarAtendimentoModal, {
  type FinalizarAtendimentoPayload,
} from "@/components/FinalizarAtendimentoModal";
import ProntuarioPinModal from "@/components/ProntuarioPinModal";
import ProntuarioCsvImportPanel from "@/components/ProntuarioCsvImportPanel";
import GoogleContactsImportModal from "@/components/GoogleContactsImportModal";
import UnificarCadastrosModal from "@/components/UnificarCadastrosModal";
import ClinicalChartsPanel from "@/components/ClinicalChartsPanel";
import type {
  Cliente,
  ClienteAtendimento,
  PacienteOpcao,
  ClienteDetalhe,
  ClienteObservacao,
  ClientePagamento,
} from "@/lib/types";
import {
  ATENDIMENTO_LABEL,
  FORMAS_PAGAMENTO,
  STATUS_ATENDIMENTO,
  STATUS_PAGAMENTO,
  TIPOS_ATENDIMENTO,
  formatCurrency,
} from "@/lib/constants";
import ConvenioSelect from "@/components/ConvenioSelect";
import MedicoSelect from "@/components/MedicoSelect";
import { clientesApiToOpcoes } from "@/lib/pacienteOpcoesUi";
import { useMedicosOptions } from "@/lib/useMedicosOptions";
import {
  resolveMedicoValue,
  validateMedicoSelection,
} from "@/lib/loadMedicosOptions";
import {
  isProntuarioObservacao,
  stripProntuarioPrefix,
} from "@/lib/prontuarioContent";

type ProntuarioEntradaDrive = {
  id: string;
  data: string;
  hora: string | null;
  medico: string | null;
  texto: string;
  tipo: string | null;
  campos: Record<string, number | string | null>;
  origem: string;
};

type Tab = "resumo" | "atendimentos" | "prontuario" | "observacoes" | "pagamentos";

type ProntuarioAccessState = {
  pinConfigured: boolean;
  unlocked: boolean;
  modoRecepcao: boolean;
  locked: boolean;
  unlockExpiresAt: string | null;
};

const emptyClienteForm = {
  nome: "",
  email: "",
  telefone: "",
  cpf: "",
  data_nascimento: "",
  sexo: "",
  convenio: "",
  observacoes_gerais: "",
};

export default function ClientesPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [somenteComAtendimento, setSomenteComAtendimento] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ClienteDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [tab, setTab] = useState<Tab>("resumo");

  const { medicos: medicosOptions, isClinica } = useMedicosOptions();
  const [atendMedicoErro, setAtendMedicoErro] = useState<string | undefined>();
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [finalizandoAtendimento, setFinalizandoAtendimento] = useState(false);
  const [finalizarErro, setFinalizarErro] = useState<string | null>(null);

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [clienteForm, setClienteForm] = useState(emptyClienteForm);
  const [savingCliente, setSavingCliente] = useState(false);
  const [clienteSalvoComSucesso, setClienteSalvoComSucesso] = useState(false);

  const [atendForm, setAtendForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    hora: "",
    tipo: "consulta",
    medico: "",
    valor: "",
    status: "realizado",
    observacoes: "",
  });
  const [obsForm, setObsForm] = useState({ texto: "" });
  const [prontuarioForm, setProntuarioForm] = useState({ texto: "" });
  const [prontuarioEntradas, setProntuarioEntradas] = useState<ProntuarioEntradaDrive[]>([]);
  const [prontuarioSeries, setProntuarioSeries] = useState<
    Record<string, { data: string; hora: string | null; valor: number }[]>
  >({});
  const [loadingProntuarioEntradas, setLoadingProntuarioEntradas] = useState(false);
  const [prontuarioAccess, setProntuarioAccess] = useState<ProntuarioAccessState | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pagForm, setPagForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    valor: "",
    status: "pago",
    forma_pagamento: "pix",
    atendimento_id: "",
    observacao: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [syncingForms, setSyncingForms] = useState(false);
  const [showGoogleContactsModal, setShowGoogleContactsModal] = useState(false);
  const [showUnificarModal, setShowUnificarModal] = useState(false);
  const [contactsInfo, setContactsInfo] = useState<string | null>(null);
  const [formLink, setFormLink] = useState<string | null>(null);
  const [formWhatsApp, setFormWhatsApp] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [agendarClienteId, setAgendarClienteId] = useState("");
  const buscaRef = useRef(busca);
  const skipBuscaDebounceRef = useRef(true);

  const clientesIniciais = useMemo<PacienteOpcao[]>(
    () => clientesApiToOpcoes(clientes),
    [clientes],
  );

  useEffect(() => {
    buscaRef.current = busca;
  }, [busca]);

  function connectDrive() {
    const redirect = encodeURIComponent("/clientes");
    window.location.href = `/api/auth/google-authorize?scope=drive&redirect=${redirect}`;
  }

  function connectContacts() {
    const redirect = encodeURIComponent("/clientes");
    window.location.href = `/api/auth/google-authorize?scope=contacts&redirect=${redirect}`;
  }

  const loadClientes = useCallback(async (q?: string, comAtendimento?: boolean) => {
    setLoadingList(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (comAtendimento) params.set('com_atendimento', '1');
      const qs = params.toString();
      const res = await fetch(`/api/clientes${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "DRIVE_NOT_CONNECTED") setDriveError(data.error);
        throw new Error(data.error || "Erro ao carregar pacientes");
      }
      setDriveError(null);
      setClientes(data.clientes ?? []);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadProntuarioStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/prontuario-acesso/status");
      const data = await res.json();
      if (res.ok) setProntuarioAccess(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadProntuarioEntradas = useCallback(async (id: string) => {
    setLoadingProntuarioEntradas(true);
    try {
      const res = await fetch(`/api/clientes/${id}/prontuario/entradas`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code !== "PRONTUARIO_LOCKED") setProntuarioEntradas([]);
        return;
      }
      setProntuarioEntradas(data.entradas ?? []);
      setProntuarioSeries(data.series ?? {});
    } catch {
      setProntuarioEntradas([]);
    } finally {
      setLoadingProntuarioEntradas(false);
    }
  }, []);

  const loadDetalhe = useCallback(async (id: string) => {
    setLoadingDetalhe(true);
    try {
      const res = await fetch(`/api/clientes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar paciente");
      setDetalhe(data.cliente);
      if (data.prontuarioAccess) {
        setProntuarioAccess((prev) => ({ ...prev, ...data.prontuarioAccess }));
      }
    } catch {
      setDetalhe(null);
    } finally {
      setLoadingDetalhe(false);
    }
  }, []);

  const syncFormularios = useCallback(async () => {
    setSyncingForms(true);
    setContactsInfo(null);
    try {
      const res = await fetch("/api/clientes/sync-formularios", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao importar");
      if (data.sincronizados > 0) {
        setContactsInfo(`${data.sincronizados} formulário(s) importado(s).`);
        if (selectedId) await loadDetalhe(selectedId);
        await loadClientes(buscaRef.current, somenteComAtendimento);
      } else {
        setContactsInfo("Nenhum formulário pendente para importar.");
      }
    } catch (e: unknown) {
      setContactsInfo(e instanceof Error ? e.message : "Erro ao importar formulários");
    } finally {
      setSyncingForms(false);
    }
  }, [selectedId, loadDetalhe, loadClientes, somenteComAtendimento]);

  const abrirGoogleContatos = useCallback(() => {
    if (driveError) return;
    setShowGoogleContactsModal(true);
  }, [driveError]);

  const onGoogleContactsImported = useCallback(
    async (summary: string) => {
      const { invalidatePacientesOpcoesClientCache } = await import(
        "@/lib/pacientesOpcoesClient"
      );
      invalidatePacientesOpcoesClientCache();
      setContactsInfo(summary);
      await loadClientes(buscaRef.current, somenteComAtendimento);
    },
    [loadClientes, somenteComAtendimento],
  );

  useEffect(() => {
    if (prontuarioAccess?.modoRecepcao && tab === "prontuario") {
      setTab("resumo");
    }
  }, [prontuarioAccess?.modoRecepcao, tab]);

  useEffect(() => {
    if (medicosOptions.length === 1 && !atendForm.medico) {
      setAtendForm((f) => ({ ...f, medico: medicosOptions[0] }));
    }
  }, [medicosOptions, atendForm.medico]);

  useEffect(() => {
    loadClientes();
    void loadProntuarioStatus();
    void syncFormularios();
    void fetch('/api/clientes/sync-agendamentos', { method: 'POST' }).catch(() => {});
    void fetch('/api/clientes/sync-prontuario', { method: 'POST' }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial única
  }, []);

  useEffect(() => {
    const connected = searchParams.get("google_connected");
    if (connected === "contacts" && !driveError) {
      setShowGoogleContactsModal(true);
      setContactsInfo("Contatos Google conectados. Busque e selecione quem importar.");
      router.replace("/clientes", { scroll: false });
    }
  }, [searchParams, driveError, router]);

  useEffect(() => {
    if (searchParams.get("finalizar") === "1") {
      setShowFinalizarModal(true);
      router.replace("/clientes", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (skipBuscaDebounceRef.current) {
      skipBuscaDebounceRef.current = false;
      return;
    }
    const t = setTimeout(() => loadClientes(busca, somenteComAtendimento), 300);
    return () => clearTimeout(t);
  }, [busca, somenteComAtendimento, loadClientes]);

  useEffect(() => {
    if (
      selectedId &&
      tab === "prontuario" &&
      prontuarioAccess &&
      !prontuarioAccess.locked &&
      !prontuarioAccess.modoRecepcao
    ) {
      void loadProntuarioEntradas(selectedId);
    }
  }, [selectedId, tab, prontuarioAccess, loadProntuarioEntradas]);

  useEffect(() => {
    if (selectedId) {
      setAgendarClienteId(selectedId);
      loadDetalhe(selectedId);
      setFormLink(null);
      setFormWhatsApp(null);
    } else setDetalhe(null);
  }, [selectedId, loadDetalhe]);

  async function gerarLinkFormulario() {
    if (!selectedId) return;
    setGeneratingLink(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/formulario-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar link");
      setFormLink(data.link);
      setFormWhatsApp(data.whatsapp_url);
      if (data.link) await navigator.clipboard.writeText(data.link);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setGeneratingLink(false);
    }
  }

  const clienteSelectOptions = useMemo(
    () =>
      clientes.map((c) => ({
        value: c.id,
        label: c.nome,
        sublabel: [c.telefone, c.convenio].filter(Boolean).join(" · ") || undefined,
      })),
    [clientes],
  );

  const ultimosAtendimentos = useMemo(() => {
    if (!detalhe) return [];
    return [...detalhe.atendimentos]
      .sort((a, b) => {
        const da = `${a.data}T${a.hora || "00:00"}`;
        const db = `${b.data}T${b.hora || "00:00"}`;
        return db.localeCompare(da);
      })
      .slice(0, 5);
  }, [detalhe]);

  const observacoesGerais = useMemo(() => {
    if (!detalhe) return [];
    return detalhe.observacoes.filter((o) => !isProntuarioObservacao(o.texto));
  }, [detalhe]);

  const prontuarioAtendimentos = useMemo(() => {
    if (!detalhe) return [];
    return detalhe.atendimentos.filter((a) => !!a.observacoes?.trim());
  }, [detalhe]);

  async function onProntuarioUnlocked() {
    setShowPinModal(false);
    await loadProntuarioStatus();
    if (selectedId) {
      await loadDetalhe(selectedId);
      void loadProntuarioEntradas(selectedId);
    }
    setTab("prontuario");
  }

  function handleTabChange(next: Tab) {
    if (next === "prontuario") {
      if (prontuarioAccess?.modoRecepcao) return;
      if (prontuarioAccess?.locked) {
        setShowPinModal(true);
        return;
      }
    }
    setTab(next);
  }

  function irAgendarConsulta(clienteId?: string) {
    const id = clienteId || selectedId || agendarClienteId;
    if (!id) {
      alert("Selecione um paciente para agendar.");
      return;
    }
    if (driveError) {
      alert("Conecte o Google Drive em Backup ou Agenda antes de agendar.");
      return;
    }
    router.push(`/agenda?agendar=1&clienteId=${encodeURIComponent(id)}`);
  }

  const resumoFinanceiro = useMemo(() => {
    if (!detalhe) return { pago: 0, pendente: 0, atendimentos: 0 };
    let pago = 0;
    let pendente = 0;
    for (const p of detalhe.pagamentos) {
      if (p.status === "pago") pago += Number(p.valor);
      else if (p.status === "pendente" || p.status === "parcial") pendente += Number(p.valor);
    }
    return { pago, pendente, atendimentos: detalhe.atendimentos.length };
  }, [detalhe]);

  function openNovoCliente() {
    setEditingClienteId(null);
    setClienteForm(emptyClienteForm);
    setClienteSalvoComSucesso(false);
    setShowClienteModal(true);
  }

  function openEditarCliente(c: Cliente) {
    setEditingClienteId(c.id);
    setClienteSalvoComSucesso(true);
    setClienteForm({
      nome: c.nome,
      email: c.email ?? "",
      telefone: c.telefone ?? "",
      cpf: c.cpf ?? "",
      data_nascimento: c.data_nascimento ?? "",
      sexo: c.sexo ?? "",
      convenio: c.convenio ?? "",
      observacoes_gerais: c.observacoes_gerais ?? "",
    });
    setShowClienteModal(true);
  }

  async function salvarCliente(e: React.FormEvent) {
    e.preventDefault();
    setSavingCliente(true);
    try {
      const url = editingClienteId ? `/api/clientes/${editingClienteId}` : "/api/clientes";
      const method = editingClienteId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clienteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar");
      const savedId = data.cliente?.id ?? editingClienteId;
      if (savedId) {
        setEditingClienteId(savedId);
        setSelectedId(savedId);
      }
      setClienteSalvoComSucesso(true);
      await loadClientes(busca);
      if (savedId && !editingClienteId) {
        await loadDetalhe(savedId);
      } else if (editingClienteId) {
        await loadDetalhe(editingClienteId);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSavingCliente(false);
    }
  }

  function abrirFinalizarAtendimento() {
    setFinalizarErro(null);
    setShowFinalizarModal(true);
  }

  async function confirmarFinalizarAtendimento(payload: FinalizarAtendimentoPayload) {
    setFinalizandoAtendimento(true);
    setFinalizarErro(null);
    try {
      const res = await fetch("/api/clientes/atendimento-avulso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: payload.clienteId || selectedId || null,
          paciente_sel: payload.pacienteSel || (payload.clienteId ? `d:${payload.clienteId}` : undefined),
          nome: payload.nome,
          telefone: payload.telefone,
          lembretes_whatsapp: payload.lembretesWhatsapp,
          data: payload.data,
          hora: payload.hora || null,
          valor: payload.valorOriginal,
          valorOriginal: payload.valorOriginal,
          descontoPercent: payload.descontoPercent,
          descontoValor: payload.descontoValor,
          forma_pagamento: payload.formaPagamento,
          plano: payload.plano || null,
          medico: payload.medico || null,
          percentual_profissional: payload.percentualProfissional,
          parcelas: payload.parcelas,
          tipo: payload.tipo,
          observacoes: payload.prontuario || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "DRIVE_NOT_CONNECTED") setDriveError(data.error);
        setFinalizarErro(data.error || "Erro ao finalizar atendimento");
        return;
      }
      setShowFinalizarModal(false);
      setFinalizarErro(null);
      await loadClientes(busca);
      if (data.cliente?.id) {
        setSelectedId(data.cliente.id);
        setTab("atendimentos");
      }
    } catch (err: unknown) {
      setFinalizarErro(err instanceof Error ? err.message : "Erro ao finalizar atendimento");
    } finally {
      setFinalizandoAtendimento(false);
    }
  }

  async function excluirCliente(id: string) {
    if (!confirm("Excluir este paciente e todo o histórico?")) return;
    const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Erro ao excluir");
      return;
    }
    if (selectedId === id) {
      setSelectedId(null);
      setDetalhe(null);
    }
    loadClientes(busca);
  }

  async function adicionarAtendimento(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    const medicoErr = validateMedicoSelection(
      medicosOptions,
      atendForm.medico,
      isClinica,
    );
    if (medicoErr) {
      setAtendMedicoErro(medicoErr);
      return;
    }
    setAtendMedicoErro(undefined);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/atendimentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...atendForm,
          medico: resolveMedicoValue(medicosOptions, atendForm.medico) || null,
          valor: atendForm.valor ? Number(atendForm.valor) : null,
          hora: atendForm.hora || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAtendForm((f) => ({ ...f, observacoes: "", valor: "" }));
      await loadDetalhe(selectedId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function adicionarObservacao(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/observacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obsForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setObsForm({ texto: "" });
      await loadDetalhe(selectedId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function adicionarProntuario(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !prontuarioForm.texto.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/prontuario/entradas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: prontuarioForm.texto.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProntuarioForm({ texto: "" });
      await loadProntuarioEntradas(selectedId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function adicionarPagamento(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/pagamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pagForm,
          valor: Number(pagForm.valor),
          atendimento_id: pagForm.atendimento_id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPagForm((f) => ({ ...f, valor: "", observacao: "", atendimento_id: "" }));
      await loadDetalhe(selectedId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function removerAtendimento(atendimentoId: string) {
    if (!selectedId || !confirm("Remover este atendimento?")) return;
    await fetch(`/api/clientes/${selectedId}/atendimentos/${atendimentoId}`, { method: "DELETE" });
    loadDetalhe(selectedId);
  }

  async function removerObservacao(observacaoId: string) {
    if (!selectedId || !confirm("Remover esta observação?")) return;
    await fetch(`/api/clientes/${selectedId}/observacoes/${observacaoId}`, { method: "DELETE" });
    loadDetalhe(selectedId);
  }

  async function removerPagamento(pagamentoId: string) {
    if (!selectedId || !confirm("Remover este pagamento?")) return;
    await fetch(`/api/clientes/${selectedId}/pagamentos/${pagamentoId}`, { method: "DELETE" });
    loadDetalhe(selectedId);
  }

  function formatData(d: string) {
    try {
      return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return d;
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = useMemo(() => {
    const base: { id: Tab; label: string; icon: typeof Users }[] = [
      { id: "resumo", label: "Resumo", icon: FileText },
      { id: "atendimentos", label: "Atendimentos", icon: Calendar },
    ];
    if (!prontuarioAccess?.modoRecepcao) {
      base.push({ id: "prontuario", label: "Prontuário", icon: Lock });
    }
    base.push(
      { id: "observacoes", label: "Observações", icon: MessageSquare },
      { id: "pagamentos", label: "Pagamentos", icon: Wallet },
    );
    return base;
  }, [prontuarioAccess?.modoRecepcao]);

  const ocultarProntuario = prontuarioAccess?.locked ?? false;

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6" data-tour="clientes-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            Pacientes
          </h1>
          <p className="text-gray-500 mt-1">
            Cadastros no seu Google Drive · formulário por link · WhatsApp preparado
          </p>
        </div>
        <div className="flex flex-wrap gap-2" data-tour="clientes-actions">
          <button
            type="button"
            onClick={abrirFinalizarAtendimento}
            disabled={!!driveError}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#1a6b1a] transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-left">
              <span className="block">Atendimento avulso</span>
              <span className="block text-xs font-normal opacity-90">Lançar atendimento</span>
            </span>
          </button>
          <button
            type="button"
            onClick={openNovoCliente}
            className="inline-flex items-center justify-center gap-2 border-2 border-emerald-700 text-emerald-800 px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-50 transition"
          >
            <Plus className="w-5 h-5" />
            Novo paciente
          </button>
          <button
            type="button"
            onClick={() => setShowUnificarModal(true)}
            disabled={!!driveError || clientes.length < 2}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
            title="Fundir dois cadastros duplicados em um só"
          >
            <GitMerge className="w-4 h-4 text-emerald-600" />
            Unificar cadastros
          </button>
          <button
            type="button"
            onClick={() => void syncFormularios()}
            disabled={!!driveError || syncingForms}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
            title="Importa respostas de formulários/cadastro online"
          >
            <RefreshCw className={`w-4 h-4 ${syncingForms ? 'animate-spin' : ''}`} />
            {syncingForms ? 'Importando...' : 'Importar formulários'}
          </button>
          <button
            type="button"
            onClick={() => void gerarLinkFormulario()}
            disabled={!!driveError || !selectedId || generatingLink}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
            title="Gera link de anamnese para o paciente selecionado"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            Anamnese
          </button>
          <button
            type="button"
            onClick={abrirGoogleContatos}
            disabled={!!driveError}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-800 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition disabled:opacity-50"
            title="Buscar nos Contatos Google e importar selecionados (20 por vez)"
          >
            <Contact className="w-5 h-5 text-emerald-600" />
            Google Contatos
          </button>
        </div>
      </div>

      {contactsInfo && (
        <p
          className={`mb-4 text-sm rounded-xl px-4 py-2 ${
            contactsInfo.includes("Erro") || contactsInfo.includes("erro")
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {contactsInfo}
        </p>
      )}

      {driveError && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3 flex-1">
            <Cloud className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Google Drive não conectado</p>
              <p className="text-sm text-amber-800 mt-1">{driveError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={connectDrive}
            className="shrink-0 bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Conectar Drive
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 min-h-[600px]">
        {/* Lista */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Buscar por nome, e-mail, telefone..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={somenteComAtendimento}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSomenteComAtendimento(checked);
                  void loadClientes(buscaRef.current, checked);
                }}
                className="rounded border-gray-300 text-emerald-600"
              />
              Só pacientes com atendimento
            </label>
            <div className="mt-3 space-y-2">
              <SearchableSelect
                options={clienteSelectOptions}
                value={agendarClienteId}
                onChange={setAgendarClienteId}
                placeholder="Agendar consulta para..."
                searchPlaceholder="Buscar paciente..."
                disabled={!!driveError || clientes.length === 0}
              />
              <button
                type="button"
                onClick={() => irAgendarConsulta()}
                disabled={!!driveError || !agendarClienteId}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50"
              >
                <CalendarPlus className="w-4 h-4" />
                Agendar consulta
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="p-8 text-center text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Carregando...
              </div>
            ) : listError ? (
              <p className="p-4 text-sm text-red-600">{listError}</p>
            ) : clientes.length === 0 ? (
              <p className="p-6 text-sm text-gray-500 text-center">
                Nenhum paciente cadastrado.
                <br />
                Clique em &quot;Novo paciente&quot; para começar.
              </p>
            ) : (
              <ul>
                {clientes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        setTab("resumo");
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-emerald-50 transition ${
                        selectedId === c.id ? "bg-emerald-50 border-l-4 border-l-emerald-600" : ""
                      }`}
                    >
                      <p className="font-medium text-gray-900 truncate">{c.nome}</p>
                      {c.telefone && (
                        <p className="text-xs text-gray-500 mt-0.5">{c.telefone}</p>
                      )}
                      {c.convenio && (
                        <p className="text-xs text-emerald-600 mt-0.5">{c.convenio}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detalhe */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm min-h-[500px]">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-500 p-8 text-center">
              <Users className="w-16 h-16 mb-4 opacity-40 text-gray-300" />
              <p className="mb-2">Selecione um paciente ou lance um atendimento avulso</p>
              <p className="text-sm text-gray-400 max-w-sm mb-6">
                Não precisa cadastrar o paciente antes — basta o nome na hora de lançar o atendimento.
              </p>
              <button
                type="button"
                onClick={abrirFinalizarAtendimento}
                disabled={!!driveError}
                className="inline-flex items-center gap-2 bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-800 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                Atendimento avulso · Lançar
              </button>
            </div>
          ) : loadingDetalhe || !detalhe ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{detalhe.nome}</h2>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                    {detalhe.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" /> {detalhe.telefone}
                      </span>
                    )}
                    {detalhe.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" /> {detalhe.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => irAgendarConsulta(detalhe.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Agendar consulta
                  </button>
                  <button
                    type="button"
                    onClick={abrirFinalizarAtendimento}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Lançar atendimento
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditarCliente(detalhe)}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => excluirCliente(detalhe.id)}
                    className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-gray-50 border-b border-gray-100">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Atendimentos</p>
                  <p className="text-lg font-bold text-gray-900">{resumoFinanceiro.atendimentos}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Pago</p>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatCurrency(resumoFinanceiro.pago)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Pendente</p>
                  <p className="text-lg font-bold text-amber-600">
                    {formatCurrency(resumoFinanceiro.pendente)}
                  </p>
                </div>
              </div>

              <div className="flex border-b border-gray-100 overflow-x-auto">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleTabChange(id)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                      tab === id
                        ? "border-emerald-600 text-emerald-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {tab === "resumo" && (
                  <div className="space-y-4 text-sm">
                    {ultimosAtendimentos.length > 0 && (
                      <div className="border border-gray-100 rounded-xl p-4 bg-white">
                        <p className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          Últimos 5 atendimentos
                        </p>
                        <ul className="space-y-3">
                          {ultimosAtendimentos.map((a) => (
                            <li
                              key={a.id}
                              className="rounded-lg border border-gray-100 bg-[#fafafa] p-3"
                            >
                              <p className="font-medium text-gray-900 text-sm">
                                {formatData(a.data)}
                                {a.hora ? ` às ${a.hora.slice(0, 5)}` : ""} —{" "}
                                {ATENDIMENTO_LABEL[a.tipo] ?? a.tipo}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {a.medico && `${a.medico} · `}
                                <span
                                  className={
                                    a.status === "realizado"
                                      ? "text-emerald-600"
                                      : a.status === "cancelado" || a.status === "faltou"
                                        ? "text-red-600"
                                        : "text-amber-600"
                                  }
                                >
                                  {ATENDIMENTO_LABEL[a.status]}
                                </span>
                                {a.valor != null && ` · ${formatCurrency(Number(a.valor))}`}
                              </p>
                              {a.observacoes && !ocultarProntuario ? (
                                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap border-t border-gray-100 pt-2">
                                  <span className="font-medium text-gray-500">Obs.: </span>
                                  {a.observacoes}
                                </p>
                              ) : a.observacoes && ocultarProntuario ? (
                                <p className="text-xs text-gray-400 mt-2 italic border-t border-gray-100 pt-2">
                                  Prontuário protegido — desbloqueie na aba Prontuário
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 mt-2 italic">
                                  Sem observações neste atendimento
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-emerald-600" />
                        Anamnese / formulário deste paciente
                      </p>
                      <p className="text-gray-600 text-xs leading-relaxed">
                        Gere um link para este paciente preencher a ficha. Links de cadastro e
                        agendamento públicos ficam em{' '}
                        <a
                          href="/dashboard/configuracoes?tab=link"
                          className="text-emerald-600 underline font-medium"
                        >
                          Configurações → Links públicos
                        </a>
                        .
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={gerarLinkFormulario}
                          disabled={generatingLink}
                          className="text-sm bg-emerald-700 text-white px-3 py-2 rounded-lg disabled:opacity-60"
                        >
                          {generatingLink ? "Gerando..." : "Gerar link (copia automaticamente)"}
                        </button>
                        <button
                          type="button"
                          onClick={syncFormularios}
                          disabled={syncingForms}
                          className="text-sm border border-gray-200 px-3 py-2 rounded-lg flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingForms ? "animate-spin" : ""}`} />
                          Sincronizar respostas
                        </button>
                        {formWhatsApp && (
                          <a
                            href={formWhatsApp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm bg-[#25D366] text-white px-3 py-2 rounded-lg flex items-center gap-1"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Enviar no WhatsApp
                          </a>
                        )}
                      </div>
                      {formLink && (
                        <p className="text-xs text-gray-600 break-all bg-white rounded-lg p-2 border">
                          {formLink}
                        </p>
                      )}
                    </div>
                    {detalhe.cpf && (
                      <p>
                        <span className="text-gray-500">CPF:</span> {detalhe.cpf}
                      </p>
                    )}
                    {detalhe.data_nascimento && (
                      <p>
                        <span className="text-gray-500">Nascimento:</span>{" "}
                        {formatData(detalhe.data_nascimento)}
                      </p>
                    )}
                    {detalhe.convenio && (
                      <p>
                        <span className="text-gray-500">Convênio:</span> {detalhe.convenio}
                      </p>
                    )}
                    {detalhe.observacoes_gerais ? (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-gray-500 mb-1">Observações gerais</p>
                        <p className="text-gray-800 whitespace-pre-wrap">{detalhe.observacoes_gerais}</p>
                      </div>
                    ) : (
                      <p className="text-gray-400">Sem observações gerais cadastradas.</p>
                    )}
                  </div>
                )}

                {tab === "atendimentos" && (
                  <div className="space-y-6">
                    <form onSubmit={adicionarAtendimento} className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-800">Registrar atendimento</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          type="date"
                          required
                          value={atendForm.data}
                          onChange={(e) => setAtendForm({ ...atendForm, data: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="time"
                          value={atendForm.hora}
                          onChange={(e) => setAtendForm({ ...atendForm, hora: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <select
                          value={atendForm.tipo}
                          onChange={(e) => setAtendForm({ ...atendForm, tipo: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {TIPOS_ATENDIMENTO.map((t) => (
                            <option key={t} value={t}>
                              {ATENDIMENTO_LABEL[t] ?? t}
                            </option>
                          ))}
                        </select>
                        <select
                          value={atendForm.status}
                          onChange={(e) => setAtendForm({ ...atendForm, status: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {STATUS_ATENDIMENTO.map((s) => (
                            <option key={s} value={s}>
                              {ATENDIMENTO_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <div className="sm:col-span-2">
                          <MedicoSelect
                            medicos={medicosOptions}
                            isClinica={isClinica}
                            value={atendForm.medico}
                            onChange={(v) => {
                              setAtendForm({ ...atendForm, medico: v });
                              setAtendMedicoErro(undefined);
                            }}
                            error={atendMedicoErro}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                          />
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Valor (R$)"
                          value={atendForm.valor}
                          onChange={(e) => setAtendForm({ ...atendForm, valor: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <textarea
                        placeholder="Observações administrativas (preferências, alertas — não clínicas)"
                        value={atendForm.observacoes}
                        onChange={(e) => setAtendForm({ ...atendForm, observacoes: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        {submitting ? "Salvando..." : "Adicionar atendimento"}
                      </button>
                    </form>
                    <ListaAtendimentos
                      items={detalhe.atendimentos}
                      formatData={formatData}
                      onRemove={removerAtendimento}
                      ocultarProntuario={ocultarProntuario}
                    />
                  </div>
                )}

                {tab === "prontuario" && (
                  <div className="space-y-6">
                    {prontuarioAccess?.pinConfigured && !prontuarioAccess.unlocked ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-medium mb-2">Prontuário protegido</p>
                        <p className="mb-3">
                          Informe o PIN da clínica para ver anotações clínicas deste paciente.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowPinModal(true)}
                          className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          Desbloquear prontuário
                        </button>
                      </div>
                    ) : (
                      <>
                        <ProntuarioCsvImportPanel
                          clienteId={selectedId!}
                          disabled={!!prontuarioAccess?.modoRecepcao}
                          onImported={() => {
                            if (selectedId) void loadProntuarioEntradas(selectedId);
                          }}
                        />
                        <form onSubmit={adicionarProntuario} className="bg-gray-50 rounded-xl p-4 space-y-3">
                          <p className="font-medium text-gray-800">Nova anotação clínica</p>
                          <textarea
                            required
                            rows={3}
                            placeholder="Evolução, conduta, achados clínicos..."
                            value={prontuarioForm.texto}
                            onChange={(e) => setProntuarioForm({ texto: e.target.value })}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          <button
                            type="submit"
                            disabled={submitting}
                            className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                          >
                            Salvar no prontuário
                          </button>
                        </form>
                        <ClinicalChartsPanel
                          birthDate={detalhe?.data_nascimento ?? null}
                          sexo={detalhe?.sexo ?? null}
                          series={prontuarioSeries}
                        />
                        <ListaProntuario
                          atendimentos={prontuarioAtendimentos}
                          observacoes={[]}
                          entradasDrive={prontuarioEntradas}
                          loadingEntradas={loadingProntuarioEntradas}
                          formatData={formatData}
                          onRemoveObservacao={removerObservacao}
                        />
                      </>
                    )}
                  </div>
                )}

                {tab === "observacoes" && (
                  <div className="space-y-6">
                    <form onSubmit={adicionarObservacao} className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-800">Nova observação</p>
                      <textarea
                        required
                        rows={3}
                        placeholder="Preferências, alertas administrativos (não clínicos)..."
                        value={obsForm.texto}
                        onChange={(e) => setObsForm({ texto: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        Salvar observação
                      </button>
                    </form>
                    <ListaObservacoes
                      items={observacoesGerais}
                      onRemove={removerObservacao}
                    />
                  </div>
                )}

                {tab === "pagamentos" && (
                  <div className="space-y-6">
                    <form onSubmit={adicionarPagamento} className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-800">Registrar pagamento</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          type="date"
                          required
                          value={pagForm.data}
                          onChange={(e) => setPagForm({ ...pagForm, data: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="Valor (R$)"
                          value={pagForm.valor}
                          onChange={(e) => setPagForm({ ...pagForm, valor: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <select
                          value={pagForm.status}
                          onChange={(e) => setPagForm({ ...pagForm, status: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {STATUS_PAGAMENTO.map((s) => (
                            <option key={s} value={s}>
                              {ATENDIMENTO_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <select
                          value={pagForm.forma_pagamento}
                          onChange={(e) =>
                            setPagForm({ ...pagForm, forma_pagamento: e.target.value })
                          }
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          {FORMAS_PAGAMENTO.map((f) => (
                            <option key={f} value={f}>
                              {ATENDIMENTO_LABEL[f] ?? f}
                            </option>
                          ))}
                        </select>
                        {detalhe.atendimentos.length > 0 && (
                          <select
                            value={pagForm.atendimento_id}
                            onChange={(e) =>
                              setPagForm({ ...pagForm, atendimento_id: e.target.value })
                            }
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2"
                          >
                            <option value="">Vincular a atendimento (opcional)</option>
                            {detalhe.atendimentos.map((a) => (
                              <option key={a.id} value={a.id}>
                                {formatData(a.data)} — {ATENDIMENTO_LABEL[a.tipo] ?? a.tipo}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <input
                        placeholder="Observação do pagamento"
                        value={pagForm.observacao}
                        onChange={(e) => setPagForm({ ...pagForm, observacao: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        Registrar pagamento
                      </button>
                    </form>
                    <ListaPagamentos
                      items={detalhe.pagamentos}
                      formatData={formatData}
                      onRemove={removerPagamento}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold">
                {editingClienteId ? "Editar paciente" : "Novo paciente"}
              </h3>
              <button type="button" onClick={() => setShowClienteModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={salvarCliente} className="p-5 space-y-4">
              <Field label="Nome *" id="nome">
                <input
                  id="nome"
                  required
                  value={clienteForm.nome}
                  onChange={(e) => setClienteForm({ ...clienteForm, nome: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Telefone" id="tel">
                  <input
                    id="tel"
                    value={clienteForm.telefone}
                    onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </Field>
                <Field label="E-mail" id="email">
                  <input
                    id="email"
                    type="email"
                    value={clienteForm.email}
                    onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="CPF" id="cpf">
                  <input
                    id="cpf"
                    value={clienteForm.cpf}
                    onChange={(e) => setClienteForm({ ...clienteForm, cpf: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </Field>
                <Field label="Nascimento" id="nasc">
                  <input
                    id="nasc"
                    type="date"
                    value={clienteForm.data_nascimento}
                    onChange={(e) =>
                      setClienteForm({ ...clienteForm, data_nascimento: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </Field>
              </div>
              <Field label="Sexo (gráficos OMS)" id="sexo">
                <select
                  id="sexo"
                  value={clienteForm.sexo}
                  onChange={(e) => setClienteForm({ ...clienteForm, sexo: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="">Não informado</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
              </Field>
              <ConvenioSelect
                value={clienteForm.convenio}
                onChange={(convenio) => setClienteForm({ ...clienteForm, convenio })}
                label="Convênio do paciente"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
              <Field label="Observações gerais" id="obs">
                <textarea
                  id="obs"
                  rows={3}
                  value={clienteForm.observacoes_gerais}
                  onChange={(e) =>
                    setClienteForm({ ...clienteForm, observacoes_gerais: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </Field>
              {clienteSalvoComSucesso && editingClienteId && !prontuarioAccess?.modoRecepcao && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-800 mb-2">Importar prontuário (CSV)</p>
                  <ProntuarioCsvImportPanel
                    clienteId={editingClienteId}
                    compact
                    disabled={prontuarioAccess?.locked ?? false}
                    onImported={() => {
                      if (editingClienteId) void loadProntuarioEntradas(editingClienteId);
                    }}
                  />
                  {prontuarioAccess?.locked && (
                    <p className="text-xs text-amber-700 mt-2">
                      Desbloqueie o prontuário na aba Prontuário para importar.
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowClienteModal(false);
                    setClienteSalvoComSucesso(false);
                  }}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200"
                >
                  {clienteSalvoComSucesso ? "Fechar" : "Cancelar"}
                </button>
                <button
                  type="submit"
                  disabled={savingCliente}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-700 text-white font-medium disabled:opacity-60"
                >
                  {savingCliente ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GoogleContactsImportModal
        open={showGoogleContactsModal}
        onClose={() => setShowGoogleContactsModal(false)}
        onImported={(summary) => void onGoogleContactsImported(summary)}
        onNeedAuth={connectContacts}
      />

      <UnificarCadastrosModal
        open={showUnificarModal}
        onClose={() => setShowUnificarModal(false)}
        clientes={clientes}
        disabled={!!driveError}
        onUnificado={(principalId) => {
          setSelectedId(principalId);
          setTab("resumo");
          void loadClientes(buscaRef.current, somenteComAtendimento);
          void loadDetalhe(principalId);
        }}
      />

      {showFinalizarModal && (
        <FinalizarAtendimentoModal
          onClose={() => {
            setShowFinalizarModal(false);
            setFinalizarErro(null);
          }}
          onConfirm={confirmarFinalizarAtendimento}
          clienteId={selectedId}
          clientesIniciais={clientesIniciais}
          nomeInicial={detalhe?.nome ?? ""}
          telefoneInicial={detalhe?.telefone ?? ""}
          planoInicial={detalhe?.convenio ?? ""}
          medicoInicial=""
          isClinica={isClinica}
          medicos={medicosOptions}
          atendimentosHistorico={detalhe?.atendimentos ?? []}
          saving={finalizandoAtendimento}
          erroEnvio={finalizarErro}
        />
      )}

      <ProntuarioPinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onUnlocked={() => void onProntuarioUnlocked()}
        pinConfigured={prontuarioAccess?.pinConfigured ?? false}
      />

    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function ListaAtendimentos({
  items,
  formatData,
  onRemove,
  ocultarProntuario = false,
}: {
  items: ClienteAtendimento[];
  formatData: (d: string) => string;
  onRemove: (id: string) => void;
  ocultarProntuario?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">Nenhum atendimento registrado.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="border border-gray-100 rounded-xl p-4 flex justify-between gap-3">
          <div>
            <p className="font-medium text-gray-900">
              {formatData(a.data)}
              {a.hora ? ` às ${a.hora.slice(0, 5)}` : ""} — {ATENDIMENTO_LABEL[a.tipo] ?? a.tipo}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {a.medico && `${a.medico} · `}
              {a.plano && <span className="text-emerald-600">{a.plano} · </span>}
              <span
                className={
                  a.status === "realizado"
                    ? "text-emerald-600"
                    : a.status === "cancelado" || a.status === "faltou"
                      ? "text-red-600"
                      : "text-amber-600"
                }
              >
                {ATENDIMENTO_LABEL[a.status]}
              </span>
              {a.valor != null && ` · ${formatCurrency(Number(a.valor))}`}
            </p>
            {a.observacoes && !ocultarProntuario && (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                <span className="font-medium text-gray-500">Prontuário: </span>
                {a.observacoes}
              </p>
            )}
            {a.observacoes && ocultarProntuario && (
              <p className="text-xs text-gray-400 mt-2 italic">Prontuário protegido</p>
            )}
          </div>
          <button type="button" onClick={() => onRemove(a.id)} className="text-red-500 shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ListaProntuario({
  atendimentos,
  observacoes,
  entradasDrive = [],
  loadingEntradas = false,
  formatData,
  onRemoveObservacao,
}: {
  atendimentos: ClienteAtendimento[];
  observacoes: ClienteObservacao[];
  entradasDrive?: ProntuarioEntradaDrive[];
  loadingEntradas?: boolean;
  formatData: (d: string) => string;
  onRemoveObservacao: (id: string) => void;
}) {
  const vazio =
    atendimentos.length === 0 &&
    observacoes.length === 0 &&
    entradasDrive.length === 0 &&
    !loadingEntradas;
  if (vazio) {
    return <p className="text-sm text-gray-400">Nenhuma anotação clínica registrada.</p>;
  }

  function formatEntradaData(data: string, hora: string | null): string {
    try {
      const base = formatData(data);
      return hora ? `${base} às ${hora.slice(0, 5)}` : base;
    } catch {
      return data;
    }
  }

  return (
    <div className="space-y-6">
      {loadingEntradas && (
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando evoluções importadas...
        </p>
      )}
      {entradasDrive.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Evoluções</p>
          <ul className="space-y-3">
            {entradasDrive.map((e) => (
              <li key={e.id} className="border border-emerald-100 rounded-xl p-4 bg-emerald-50/30">
                <p className="font-medium text-gray-900 text-sm">
                  {formatEntradaData(e.data, e.hora)}
                  {e.tipo ? ` — ${e.tipo}` : ""}
                </p>
                {e.medico && <p className="text-xs text-gray-500 mt-0.5">{e.medico}</p>}
                {e.texto && (
                  <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{e.texto}</p>
                )}
                {Object.keys(e.campos ?? {}).length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {Object.entries(e.campos)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                )}
                {e.origem === "csv_import" && (
                  <p className="text-xs text-gray-400 mt-1">Importado via CSV</p>
                )}
                {e.origem === "legado_observacao" && (
                  <p className="text-xs text-gray-400 mt-1">Migrado de observação legada</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {atendimentos.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Por atendimento</p>
          <ul className="space-y-3">
            {atendimentos.map((a) => (
              <li key={a.id} className="border border-gray-100 rounded-xl p-4">
                <p className="font-medium text-gray-900 text-sm">
                  {formatData(a.data)}
                  {a.hora ? ` às ${a.hora.slice(0, 5)}` : ""} — {ATENDIMENTO_LABEL[a.tipo] ?? a.tipo}
                </p>
                {a.medico && <p className="text-xs text-gray-500 mt-0.5">{a.medico}</p>}
                <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{a.observacoes}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {observacoes.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Anotações avulsas</p>
          <ul className="space-y-3">
            {observacoes.map((o) => (
              <li key={o.id} className="border border-gray-100 rounded-xl p-4 flex justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">
                    {format(parseISO(o.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    {o.autor ? ` · ${o.autor}` : ""}
                  </p>
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {stripProntuarioPrefix(o.texto)}
                  </p>
                </div>
                <button type="button" onClick={() => onRemoveObservacao(o.id)} className="text-red-500 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ListaObservacoes({
  items,
  onRemove,
}: {
  items: ClienteObservacao[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">Nenhuma observação.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((o) => (
        <li key={o.id} className="border border-gray-100 rounded-xl p-4 flex justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">
              {format(parseISO(o.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {o.autor ? ` · ${o.autor}` : ""}
            </p>
            <p className="text-gray-800 whitespace-pre-wrap">{o.texto}</p>
          </div>
          <button type="button" onClick={() => onRemove(o.id)} className="text-red-500 shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ListaPagamentos({
  items,
  formatData,
  onRemove,
}: {
  items: ClientePagamento[];
  formatData: (d: string) => string;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">Nenhum pagamento registrado.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((p) => (
        <li key={p.id} className="border border-gray-100 rounded-xl p-4 flex justify-between gap-3">
          <div>
            <p className="font-medium text-gray-900">
              {formatCurrency(Number(p.valor))} — {formatData(p.data)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {ATENDIMENTO_LABEL[p.status]} ·{" "}
              {p.forma_pagamento ? ATENDIMENTO_LABEL[p.forma_pagamento] : "—"}
            </p>
            {p.observacao && <p className="text-sm text-gray-600 mt-1">{p.observacao}</p>}
          </div>
          <button type="button" onClick={() => onRemove(p.id)} className="text-red-500 shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
