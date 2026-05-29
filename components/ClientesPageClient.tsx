"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import FinalizarAtendimentoModal, {
  type FinalizarAtendimentoPayload,
} from "@/components/FinalizarAtendimentoModal";
import type {
  Cliente,
  ClienteAtendimento,
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

type Tab = "resumo" | "atendimentos" | "observacoes" | "pagamentos";

const emptyClienteForm = {
  nome: "",
  email: "",
  telefone: "",
  cpf: "",
  data_nascimento: "",
  convenio: "",
  observacoes_gerais: "",
};

export default function ClientesPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ClienteDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [tab, setTab] = useState<Tab>("resumo");

  const [medicosOptions, setMedicosOptions] = useState<string[]>([]);
  const [isClinica, setIsClinica] = useState(false);
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [finalizandoAtendimento, setFinalizandoAtendimento] = useState(false);
  const [finalizarErro, setFinalizarErro] = useState<string | null>(null);

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [clienteForm, setClienteForm] = useState(emptyClienteForm);
  const [savingCliente, setSavingCliente] = useState(false);

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
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [contactsInfo, setContactsInfo] = useState<string | null>(null);
  const [formLink, setFormLink] = useState<string | null>(null);
  const [formWhatsApp, setFormWhatsApp] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  function connectDrive() {
    const redirect = encodeURIComponent("/clientes");
    window.location.href = `/api/auth/google-authorize?scope=drive&redirect=${redirect}`;
  }

  function connectContacts() {
    const redirect = encodeURIComponent("/clientes");
    window.location.href = `/api/auth/google-authorize?scope=contacts&redirect=${redirect}`;
  }

  const loadMedicos = useCallback(async () => {
    try {
      const res = await fetch("/api/perfil");
      const data = await res.json();
      if (!res.ok) return;
      const profile = data.profile;
      if (profile?.user_type === "clinica") {
        setIsClinica(true);
        const medRes = await fetch("/api/perfil/medicos");
        const medData = await medRes.json();
        if (medRes.ok && medData.medicos) {
          setMedicosOptions(medData.medicos.map((m: { nome: string }) => m.nome));
        }
      } else {
        setIsClinica(false);
        if (profile?.full_name) {
          setMedicosOptions([profile.full_name]);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadClientes = useCallback(async (q?: string) => {
    setLoadingList(true);
    setListError(null);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/clientes${params}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "DRIVE_NOT_CONNECTED") setDriveError(data.error);
        throw new Error(data.error || "Erro ao carregar clientes");
      }
      setDriveError(null);
      setClientes(data.clientes ?? []);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadDetalhe = useCallback(async (id: string) => {
    setLoadingDetalhe(true);
    try {
      const res = await fetch(`/api/clientes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar cliente");
      setDetalhe(data.cliente);
    } catch {
      setDetalhe(null);
    } finally {
      setLoadingDetalhe(false);
    }
  }, []);

  const syncFormularios = useCallback(async () => {
    setSyncingForms(true);
    try {
      const res = await fetch("/api/clientes/sync-formularios", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.sincronizados > 0) {
        if (selectedId) await loadDetalhe(selectedId);
        await loadClientes(busca);
      }
    } catch {
      /* ignore */
    } finally {
      setSyncingForms(false);
    }
  }, [busca, selectedId, loadDetalhe, loadClientes]);

  const syncGoogleContacts = useCallback(async () => {
    if (driveError) return;
    setSyncingContacts(true);
    setContactsInfo(null);
    try {
      const res = await fetch("/api/clientes/sync-google-contacts", {
        method: "POST",
      });
      const data = await res.json();
      if (data.code === "CONTACTS_NOT_CONNECTED") {
        connectContacts();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Erro ao importar contatos");
      setContactsInfo(
        `${data.criados ?? 0} novo(s), ${data.ignorados ?? 0} já existente(s) (${data.totalGoogle ?? 0} no Google).`,
      );
      await loadClientes(busca);
    } catch (e: unknown) {
      setContactsInfo(
        e instanceof Error ? e.message : "Erro ao importar contatos",
      );
    } finally {
      setSyncingContacts(false);
    }
  }, [busca, driveError, loadClientes]);

  useEffect(() => {
    loadMedicos();
    loadClientes();
    syncFormularios();
  }, [loadMedicos, loadClientes, syncFormularios]);

  useEffect(() => {
    const connected = searchParams.get("google_connected");
    if (connected === "contacts" && !driveError) {
      void syncGoogleContacts();
      router.replace("/clientes", { scroll: false });
    }
  }, [searchParams, driveError, router, syncGoogleContacts]);

  useEffect(() => {
    if (searchParams.get("finalizar") === "1") {
      setShowFinalizarModal(true);
      router.replace("/clientes", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const t = setTimeout(() => loadClientes(busca), 300);
    return () => clearTimeout(t);
  }, [busca, loadClientes]);

  useEffect(() => {
    if (selectedId) {
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
    setShowClienteModal(true);
  }

  function openEditarCliente(c: Cliente) {
    setEditingClienteId(c.id);
    setClienteForm({
      nome: c.nome,
      email: c.email ?? "",
      telefone: c.telefone ?? "",
      cpf: c.cpf ?? "",
      data_nascimento: c.data_nascimento ?? "",
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
      setShowClienteModal(false);
      await loadClientes(busca);
      if (data.cliente?.id) {
        setSelectedId(data.cliente.id);
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
          nome: payload.nome,
          data: payload.data,
          hora: payload.hora || null,
          valor: payload.valorOriginal,
          valorOriginal: payload.valorOriginal,
          descontoPercent: payload.descontoPercent,
          descontoValor: payload.descontoValor,
          forma_pagamento: payload.formaPagamento,
          plano: payload.plano || null,
          medico: payload.medico || null,
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
    if (!confirm("Excluir este cliente e todo o histórico?")) return;
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
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clientes/${selectedId}/atendimentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...atendForm,
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

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "resumo", label: "Resumo", icon: FileText },
    { id: "atendimentos", label: "Atendimentos", icon: Calendar },
    { id: "observacoes", label: "Observações", icon: MessageSquare },
    { id: "pagamentos", label: "Pagamentos", icon: Wallet },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-[#228B22]" />
            Clientes
          </h1>
          <p className="text-gray-500 mt-1">
            Dados no seu Google Drive · formulário por link · WhatsApp preparado
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abrirFinalizarAtendimento}
            disabled={!!driveError}
            className="inline-flex items-center justify-center gap-2 bg-[#228B22] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#1a6b1a] transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" />
            Finalizar atendimento
          </button>
          <button
            type="button"
            onClick={openNovoCliente}
            className="inline-flex items-center justify-center gap-2 border-2 border-[#013a01] text-[#013a01] px-5 py-2.5 rounded-xl font-medium hover:bg-green-50 transition"
          >
            <Plus className="w-5 h-5" />
            Novo cliente
          </button>
          <button
            type="button"
            onClick={() => void syncGoogleContacts()}
            disabled={!!driveError || syncingContacts}
            className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-800 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition disabled:opacity-50"
            title="Importa contatos do Google para a lista de clientes (sem duplicar e-mail ou telefone)"
          >
            <Contact
              className={`w-5 h-5 text-[#228B22] ${syncingContacts ? "animate-pulse" : ""}`}
            />
            {syncingContacts ? "Importando..." : "Google Contatos"}
          </button>
        </div>
      </div>

      {contactsInfo && (
        <p
          className={`mb-4 text-sm rounded-xl px-4 py-2 ${
            contactsInfo.includes("Erro") || contactsInfo.includes("erro")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-800"
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
            className="shrink-0 bg-[#013a01] text-white px-4 py-2 rounded-lg text-sm font-medium"
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
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
              />
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
                Nenhum cliente cadastrado.
                <br />
                Clique em &quot;Novo cliente&quot; para começar.
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
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-green-50 transition ${
                        selectedId === c.id ? "bg-green-50 border-l-4 border-l-[#228B22]" : ""
                      }`}
                    >
                      <p className="font-medium text-gray-900 truncate">{c.nome}</p>
                      {c.telefone && (
                        <p className="text-xs text-gray-500 mt-0.5">{c.telefone}</p>
                      )}
                      {c.convenio && (
                        <p className="text-xs text-[#228B22] mt-0.5">{c.convenio}</p>
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
              <p className="mb-2">Selecione um cliente ou finalize um atendimento avulso</p>
              <p className="text-sm text-gray-400 max-w-sm mb-6">
                Não é obrigatório cadastrar o paciente antes: use apenas o nome na finalização.
              </p>
              <button
                type="button"
                onClick={abrirFinalizarAtendimento}
                disabled={!!driveError}
                className="inline-flex items-center gap-2 bg-[#013a01] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#025201] disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                Finalizar atendimento
              </button>
            </div>
          ) : loadingDetalhe || !detalhe ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-[#228B22]" />
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
                    onClick={abrirFinalizarAtendimento}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#013a01] text-white text-sm font-medium hover:bg-[#025201]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar atendimento
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
                  <p className="text-lg font-bold text-green-700">
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
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                      tab === id
                        ? "border-[#228B22] text-[#228B22]"
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
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-[#228B22]" />
                        Formulário para o paciente preencher
                      </p>
                      <p className="text-gray-600 text-xs">
                        Para cliente já cadastrado. Para autocadastro sem cadastro prévio, use o link no{' '}
                        <a href="/dashboard" className="text-[#228B22] underline font-medium">
                          Dashboard
                        </a>
                        .
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={gerarLinkFormulario}
                          disabled={generatingLink}
                          className="text-sm bg-[#013a01] text-white px-3 py-2 rounded-lg disabled:opacity-60"
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
                        {medicosOptions.length > 0 ? (
                          <select
                            value={atendForm.medico}
                            onChange={(e) => setAtendForm({ ...atendForm, medico: e.target.value })}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          >
                            <option value="">Médico (opcional)</option>
                            {medicosOptions.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            placeholder="Médico"
                            value={atendForm.medico}
                            onChange={(e) => setAtendForm({ ...atendForm, medico: e.target.value })}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                        )}
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
                        placeholder="Observações do atendimento"
                        value={atendForm.observacoes}
                        onChange={(e) => setAtendForm({ ...atendForm, observacoes: e.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#013a01] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        {submitting ? "Salvando..." : "Adicionar atendimento"}
                      </button>
                    </form>
                    <ListaAtendimentos
                      items={detalhe.atendimentos}
                      formatData={formatData}
                      onRemove={removerAtendimento}
                    />
                  </div>
                )}

                {tab === "observacoes" && (
                  <div className="space-y-6">
                    <form onSubmit={adicionarObservacao} className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <p className="font-medium text-gray-800">Nova observação</p>
                      <textarea
                        required
                        rows={3}
                        placeholder="Anotação clínica, preferências, alertas..."
                        value={obsForm.texto}
                        onChange={(e) => setObsForm({ texto: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#013a01] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        Salvar observação
                      </button>
                    </form>
                    <ListaObservacoes
                      items={detalhe.observacoes}
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
                        className="bg-[#013a01] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
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
                {editingClienteId ? "Editar cliente" : "Novo cliente"}
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
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Telefone" id="tel">
                  <input
                    id="tel"
                    value={clienteForm.telefone}
                    onChange={(e) => setClienteForm({ ...clienteForm, telefone: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
                  />
                </Field>
                <Field label="E-mail" id="email">
                  <input
                    id="email"
                    type="email"
                    value={clienteForm.email}
                    onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="CPF" id="cpf">
                  <input
                    id="cpf"
                    value={clienteForm.cpf}
                    onChange={(e) => setClienteForm({ ...clienteForm, cpf: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
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
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
                  />
                </Field>
              </div>
              <ConvenioSelect
                value={clienteForm.convenio}
                onChange={(convenio) => setClienteForm({ ...clienteForm, convenio })}
                label="Convênio do paciente"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
              />
              <Field label="Observações gerais" id="obs">
                <textarea
                  id="obs"
                  rows={3}
                  value={clienteForm.observacoes_gerais}
                  onChange={(e) =>
                    setClienteForm({ ...clienteForm, observacoes_gerais: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
                />
              </Field>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClienteModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCliente}
                  className="flex-1 py-2.5 rounded-lg bg-[#013a01] text-white font-medium disabled:opacity-60"
                >
                  {savingCliente ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFinalizarModal && (
        <FinalizarAtendimentoModal
          onClose={() => {
            setShowFinalizarModal(false);
            setFinalizarErro(null);
          }}
          onConfirm={confirmarFinalizarAtendimento}
          clienteId={selectedId}
          nomeInicial={detalhe?.nome ?? ""}
          planoInicial={detalhe?.convenio ?? ""}
          medicoInicial=""
          isClinica={isClinica}
          medicos={medicosOptions}
          atendimentosHistorico={detalhe?.atendimentos ?? []}
          saving={finalizandoAtendimento}
          erroEnvio={finalizarErro}
        />
      )}

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
}: {
  items: ClienteAtendimento[];
  formatData: (d: string) => string;
  onRemove: (id: string) => void;
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
              {a.plano && <span className="text-[#228B22]">{a.plano} · </span>}
              <span
                className={
                  a.status === "realizado"
                    ? "text-green-600"
                    : a.status === "cancelado" || a.status === "faltou"
                      ? "text-red-600"
                      : "text-amber-600"
                }
              >
                {ATENDIMENTO_LABEL[a.status]}
              </span>
              {a.valor != null && ` · ${formatCurrency(Number(a.valor))}`}
            </p>
            {a.observacoes && (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                <span className="font-medium text-gray-500">Prontuário: </span>
                {a.observacoes}
              </p>
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
