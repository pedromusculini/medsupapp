"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import MultiSelect from "./MultiSelect";
import ProntuarioPinModal from "@/components/ProntuarioPinModal";
import {
  BACKUP_SECTIONS,
  DEFAULT_BACKUP_SECTIONS,
  type BackupSectionId,
  sectionsRequireProntuarioPin,
} from "@/lib/backupCatalog";
import type { BackupDrivePayload } from "@/lib/backupDriveExport";
import {
  appendBackupSectionsToCsv,
  buildBackupSectionJsonFiles,
} from "@/lib/backupCsvSections";
import { BACKUP_ASYNC_PATIENT_THRESHOLD } from "@/lib/backupExportJobs";
import { useClinicaTitular } from "@/lib/useClinicaTitular";
import JSZip from "jszip";
import {
  loadConsultations,
  type ConsultationRecord,
  TIPO_CONSULTA_UI,
  STATUS_CONSULTA_UI,
} from "@/lib/consultations";
import { STORAGE_KEY_FINANCEIRO } from "@/lib/constants";
import {
  buildPlanoFilterOptions,
  buildServicoFilterOptions,
  consultaMatchesPlanoFilter,
  consultaMatchesServicoFilter,
  mapConvenioPorPaciente,
  planosDaConsulta,
  servicoDaConsulta,
  type ClienteResumoBackup,
} from "@/lib/backupHelpers";

type FinanceTransacao = {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  data: string;
  valor: number;
  categoria: string | null;
  medico: string | null;
  observacao: string | null;
  splits?: { medico: string; porcentagem: number; valor_split: number }[];
};

type Profile = {
  user_type: "medico" | "clinica";
  full_name?: string;
};

type ClinicaMedico = {
  id: string;
  nome: string;
  crm?: string;
  specialty?: string;
};

type DriveFile = {
  id: string;
  name: string;
  size?: string;
  mimeType?: string;
  createdTime?: string;
};

export default function BackupPageClient() {
  const [events, setEvents] = useState<ConsultationRecord[]>([]);
  const [clientes, setClientes] = useState<ClienteResumoBackup[]>([]);
  const [financeiro, setFinanceiro] = useState<FinanceTransacao[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Perfil e tipo de usuário
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinicaMedicos, setClinicaMedicos] = useState<ClinicaMedico[]>([]);
  const isMedico = profile?.user_type === "medico";

  // Filtros
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [filterPacientes, setFilterPacientes] = useState<string[]>([]);
  const [filterServicos, setFilterServicos] = useState<string[]>([]);
  const [filterPlanos, setFilterPlanos] = useState<string[]>([]);
  const [filterMedicos, setFilterMedicos] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<BackupSectionId[]>(
    () => [...DEFAULT_BACKUP_SECTIONS],
  );
  const [prontuarioAccess, setProntuarioAccess] = useState<{
    pinConfigured: boolean;
    unlocked: boolean;
    modoRecepcao: boolean;
    locked: boolean;
  } | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [fetchingDriveData, setFetchingDriveData] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{
    phase: string;
    percent: number;
    detail?: string;
  } | null>(null);

  const isClinica = profile?.user_type === "clinica";
  const clinicaTitular = useClinicaTitular();
  const clinicaAccessLoading = isClinica && prontuarioAccess === null;

  const clinicaNeedsPinSetup =
    isClinica && prontuarioAccess !== null && !prontuarioAccess.pinConfigured;

  const clinicaModoRecepcaoBlock =
    isClinica && !!prontuarioAccess?.modoRecepcao;

  const clinicaPinGate =
    isClinica &&
    prontuarioAccess !== null &&
    prontuarioAccess.pinConfigured &&
    !prontuarioAccess.unlocked;

  function assertClinicaCanExport(): void {
    if (!isClinica) return;
    if (!prontuarioAccess?.pinConfigured) {
      throw new Error(
        "Configure um PIN do prontuário em Meu Perfil antes de exportar backup.",
      );
    }
    if (prontuarioAccess.modoRecepcao) {
      throw new Error("Exportação de backup indisponível no modo recepção.");
    }
    if (!prontuarioAccess.unlocked) {
      setShowPinModal(true);
      throw new Error("Informe o PIN do prontuário para exportar backup.");
    }
  }

  // Conectar Google Drive via autorização incremental
  function handleConnectDrive() {
    setIsAuthorizing(true);
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/auth/google-authorize?scope=drive&redirect=${redirect}`;
  }

  // Verificar se autorização foi concluída (via URL param)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'drive') {
      setIsGoogleConnected(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Verificar conexão com Google Drive via sessão (token já pode estar na sessão)
  useEffect(() => {
    async function checkSessionConnection() {
      if (isGoogleConnected) return;
      try {
        const res = await fetch("/api/google-drive");
        if (res.ok) {
          setIsGoogleConnected(true);
        }
      } catch {
        // Silencioso - não conectado ainda
      }
    }
    checkSessionConnection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/prontuario-acesso/status")
      .then((r) => r.json())
      .then((data) => {
        if (data) setProntuarioAccess(data);
      })
      .catch(() => {});
  }, []);

  const visibleSections = useMemo(
    () => BACKUP_SECTIONS.filter((s) => !s.clinicaOnly || isClinica),
    [isClinica],
  );

  const sensitiveSelected = useMemo(
    () => sectionsRequireProntuarioPin(selectedSections),
    [selectedSections],
  );

  const patientCountForExport = useMemo(
    () => (filterPacientes.length > 0 ? filterPacientes.length : clientes.length),
    [filterPacientes, clientes.length],
  );

  async function pollBackupJob(jobId: string): Promise<BackupDrivePayload> {
    const maxAttempts = 600;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const res = await fetch(
        `/api/backup/dados?jobId=${encodeURIComponent(jobId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro na exportação assíncrona");
      }
      setBackupProgress({
        phase: data.phase ?? "processando",
        percent: data.percent ?? 0,
        detail: data.detail,
      });
      if (data.status === "done" && data.result) {
        return data.result as BackupDrivePayload;
      }
      if (data.status === "error") {
        throw new Error(data.error || "Erro na exportação assíncrona");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Tempo esgotado aguardando exportação do backup");
  }

  const fetchDriveBackupData = useCallback(async (): Promise<BackupDrivePayload | null> => {
    const driveSections = selectedSections.filter((s) => s !== "consultas_agenda");
    if (driveSections.length === 0) return null;

    if (isClinica) {
      if (!prontuarioAccess?.pinConfigured) {
        throw new Error(
          "Configure um PIN do prontuário em Meu Perfil antes de exportar backup.",
        );
      }
      if (prontuarioAccess.modoRecepcao) {
        throw new Error("Exportação de backup indisponível no modo recepção.");
      }
      if (!prontuarioAccess.unlocked) {
        setShowPinModal(true);
        throw new Error("Informe o PIN do prontuário para exportar backup.");
      }
    } else if (sensitiveSelected && prontuarioAccess?.locked) {
      setShowPinModal(true);
      throw new Error("Desbloqueie o prontuário com o PIN para exportar dados clínicos.");
    }

    setFetchingDriveData(true);
    setBackupProgress({ phase: "preparando", percent: 0 });
    try {
      const useAsync = patientCountForExport > BACKUP_ASYNC_PATIENT_THRESHOLD;
      const res = await fetch("/api/backup/dados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: driveSections,
          pacientes: filterPacientes.length > 0 ? filterPacientes : undefined,
          async: useAsync,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PRONTUARIO_LOCKED") setShowPinModal(true);
        if (data.code === "PRONTUARIO_PIN_NOT_CONFIGURED") {
          throw new Error(
            data.error ||
              "Configure um PIN do prontuário em Meu Perfil antes de exportar backup.",
          );
        }
        throw new Error(data.error || "Erro ao buscar dados do Drive");
      }

      if (data.async && data.jobId) {
        setBackupProgress({
          phase: "fila",
          percent: 0,
          detail: `${data.patientCount ?? patientCountForExport} pacientes — exportação em segundo plano`,
        });
        return await pollBackupJob(String(data.jobId));
      }

      setBackupProgress({ phase: "concluido", percent: 100 });
      return data as BackupDrivePayload;
    } finally {
      setFetchingDriveData(false);
    }
  }, [
    selectedSections,
    filterPacientes,
    sensitiveSelected,
    prontuarioAccess,
    isClinica,
    patientCountForExport,
  ]);

  function toggleSection(id: BackupSectionId) {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function selectAllSections() {
    setSelectedSections(visibleSections.map((s) => s.id));
  }

  const reloadAgenda = useCallback(() => {
    setEvents(loadConsultations());
  }, []);

  // Agenda (localStorage)
  useEffect(() => {
    reloadAgenda();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "medsupapp-consultations") reloadAgenda();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("medsupapp-consultations-updated", reloadAgenda);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("medsupapp-consultations-updated", reloadAgenda);
    };
  }, [reloadAgenda]);

  // Financeiro (API + fallback local) — só titular
  useEffect(() => {
    if (clinicaTitular === false) {
      setFinanceiro([]);
      return;
    }
    if (clinicaTitular !== true) return;
    async function loadFinanceiro() {
      try {
        const res = await fetch("/api/financeiro");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setFinanceiro(data);
            return;
          }
        }
      } catch {
        /* fallback */
      }
      const fin = window.localStorage.getItem(STORAGE_KEY_FINANCEIRO);
      if (fin) {
        try {
          setFinanceiro(JSON.parse(fin));
        } catch {
          /* ignora */
        }
      }
    }
    loadFinanceiro();
  }, [clinicaTitular]);

  // Clientes no Drive (planos/convênios dos pacientes)
  useEffect(() => {
    async function loadClientes() {
      try {
        const res = await fetch("/api/clientes");
        if (!res.ok) return;
        const data = await res.json();
        const list = (data.clientes ?? []) as { nome?: string; convenio?: string | null }[];
        setClientes(
          list
            .filter((c) => c.nome?.trim())
            .map((c) => ({ nome: c.nome!.trim(), convenio: c.convenio ?? null })),
        );
      } catch {
        /* Drive pode estar offline */
      }
    }
    loadClientes();
  }, [isGoogleConnected]);

  // Carregar perfil e determinar tipo de usuário
  useEffect(() => {
    fetch("/api/perfil")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          // Se for clínica, carregar médicos
          if (data.profile.user_type === "clinica") {
            fetch("/api/perfil/medicos")
              .then((r) => r.json())
              .then((d) => {
                if (d.medicos) setClinicaMedicos(d.medicos);
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  // Opções para filtros
  const convenioPorPaciente = useMemo(
    () => mapConvenioPorPaciente(clientes),
    [clientes],
  );

  const pacientesOptions = useMemo(() => {
    const names = new Set<string>();
    for (const e of events) {
      if (e.patient?.trim()) names.add(e.patient.trim());
    }
    for (const c of clientes) {
      if (c.nome?.trim()) names.add(c.nome.trim());
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((p) => ({ value: p, label: p }));
  }, [events, clientes]);

  const servicosOptions = useMemo(
    () => buildServicoFilterOptions(events),
    [events],
  );

  const planosOptions = useMemo(
    () => buildPlanoFilterOptions(events, clientes),
    [events, clientes],
  );

  const medicosOptions = useMemo(
    () =>
      clinicaMedicos.map((m) => ({
        value: m.nome,
        label: m.nome,
      })),
    [clinicaMedicos],
  );

  // Aplicar filtros nos dados
  const filteredEvents = useMemo(() => {
    let list = [...events];

    // Filtro de período
    if (startDate) {
      list = list.filter((e) => e.start && e.start >= startDate);
    }
    if (endDate) {
      list = list.filter((e) => e.end && e.end <= endDate + "T23:59:59");
    }

    // Filtro de paciente
    if (filterPacientes.length > 0) {
      list = list.filter((e) => e.patient && filterPacientes.includes(e.patient));
    }

    if (filterServicos.length > 0) {
      list = list.filter((e) => consultaMatchesServicoFilter(e, filterServicos));
    }

    if (filterPlanos.length > 0) {
      list = list.filter((e) =>
        consultaMatchesPlanoFilter(e, filterPlanos, convenioPorPaciente),
      );
    }

    return list;
  }, [
    events,
    startDate,
    endDate,
    filterPacientes,
    filterServicos,
    filterPlanos,
    convenioPorPaciente,
  ]);

  const filteredFinanceiro = useMemo(() => {
    let list = [...financeiro];

    // Filtro de período (usar data da transação)
    if (startDate) {
      list = list.filter((t) => t.data && t.data >= startDate);
    }
    if (endDate) {
      list = list.filter((t) => t.data && t.data <= endDate + "T23:59:59");
    }

    // Filtro de médico
    if (filterMedicos.length > 0 && !isMedico) {
      list = list.filter(
        (t) => t.medico && filterMedicos.includes(t.medico),
      );
    }

    return list;
  }, [financeiro, startDate, endDate, filterMedicos, isMedico]);

  const countConsultas = filteredEvents.length;
  const pacientesUnicos = useMemo(
    () => new Set(filteredEvents.map((e) => e.patient).filter(Boolean)).size,
    [filteredEvents],
  );
  const faturamentoTotal = useMemo(
    () => filteredEvents.reduce((s, e) => s + (e.value ?? 0), 0),
    [filteredEvents],
  );
  const faturamentoFinanceiro = useMemo(
    () =>
      filteredFinanceiro
        .filter((t) => t.tipo === "entrada")
        .reduce((s, t) => s + t.valor, 0),
    [filteredFinanceiro],
  );
  const despesasFinanceiro = useMemo(
    () =>
      filteredFinanceiro
        .filter((t) => t.tipo === "saida")
        .reduce((s, t) => s + t.valor, 0),
    [filteredFinanceiro],
  );

  /** Gera CSV completo: pacientes, consultas, faturamento e seções do Drive */
  function gerarCsvCompleto(drivePayload: BackupDrivePayload | null): string {
    const linhas: string[] = [];

    if (selectedSections.includes("consultas_agenda")) {
      linhas.push("=== CONSULTAS (AGENDA) ===");
      linhas.push(
        "Título;Paciente;Serviço;Plano/Convênio;Tipo;Status;Valor;Início;Fim;Endereço;Google Calendar",
      );
      for (const e of filteredEvents) {
        const planos = planosDaConsulta(e);
        const planoCsv = planos.length > 0 ? planos.join(" | ") : "";
        const tipo = e.tipoConsulta
          ? TIPO_CONSULTA_UI[e.tipoConsulta]?.label ?? e.tipoConsulta
          : "";
        const status = e.status
          ? STATUS_CONSULTA_UI[e.status]?.label ?? e.status
          : "";
        linhas.push(
          [
            e.title ?? "",
            e.patient ?? "",
            servicoDaConsulta(e),
            planoCsv,
            tipo,
            status,
            (e.value ?? 0).toFixed(2),
            e.start?.toString() ?? "",
            e.end?.toString() ?? "",
            e.location ?? "",
            e.googleEventId ? "Sim" : "Não",
          ].join(";"),
        );
      }

      linhas.push("");
      linhas.push("=== RESUMO FINANCEIRO (AGENDA) ===");
      linhas.push("Faturamento Total;Pacientes Únicos;Consultas");
      linhas.push(
        `${faturamentoTotal.toFixed(2)};${pacientesUnicos};${countConsultas}`,
      );
    }

    if (selectedSections.includes("financeiro_transacoes")) {
      linhas.push("");
      linhas.push("=== TRANSAÇÕES FINANCEIRAS ===");
      linhas.push("Tipo;Descrição;Data;Categoria;Médico;Valor;Observação;Splits");
      for (const t of filteredFinanceiro) {
        const splitsStr = t.splits
          ? t.splits
              .map(
                (s) =>
                  `${s.medico}: ${s.porcentagem}% (R$ ${s.valor_split.toFixed(2)})`,
              )
              .join(" | ")
          : "";
        linhas.push(
          [
            t.tipo === "entrada" ? "Entrada" : "Saída",
            t.descricao,
            t.data ?? "",
            t.categoria ?? "",
            t.medico ?? "",
            t.valor.toFixed(2),
            t.observacao ?? "",
            splitsStr,
          ].join(";"),
        );
      }

      linhas.push("");
      linhas.push("=== TOTAIS FINANCEIROS ===");
      linhas.push("Entradas;Saídas;Saldo");
      linhas.push(
        `${faturamentoFinanceiro.toFixed(2)};${despesasFinanceiro.toFixed(
          2,
        )};${(faturamentoFinanceiro - despesasFinanceiro).toFixed(2)}`,
      );
    }

    appendBackupSectionsToCsv(linhas, drivePayload, selectedSections);

    linhas.push("");
    linhas.push("=== METADADOS ===");
    linhas.push(
      "Exportado em;Aplicativo;Total consultas bruto;Período filtro;Pacientes filtro;Serviços filtro;Planos filtro;Médicos filtro;Seções",
    );
    linhas.push(
      `${new Date().toLocaleString("pt-BR")};MedSupApp;${events.length};` +
        `${startDate || "sem filtro"} a ${endDate || "sem filtro"};` +
        `${filterPacientes.length > 0 ? filterPacientes.join(", ") : "todos"};` +
        `${filterServicos.length > 0 ? filterServicos.join(", ") : "todos"};` +
        `${filterPlanos.length > 0 ? filterPlanos.join(", ") : "todos"};` +
        `${filterMedicos.length > 0 ? filterMedicos.join(", ") : "todos"};` +
        selectedSections.join(", "),
    );

    return linhas.join("\n");
  }

  async function downloadBackupZip(
    csv: string,
    drivePayload: BackupDrivePayload | null,
  ): Promise<void> {
    const stamp = new Date().toISOString().slice(0, 10);
    const zip = new JSZip();
    zip.file(`backup_${stamp}.csv`, "\ufeff" + csv);
    for (const file of buildBackupSectionJsonFiles(drivePayload)) {
      zip.file(file.name, file.content);
    }

    setBackupProgress({ phase: "compactando", percent: 0, detail: "Gerando ZIP..." });
    const blob = await zip.generateAsync(
      { type: "blob", compression: "DEFLATE" },
      (metadata) => {
        setBackupProgress({
          phase: "compactando",
          percent: Math.round(metadata.percent),
          detail: "Gerando ZIP...",
        });
      },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `medsupapp_backup_${stamp}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /** Baixar ZIP local (CSV + JSONs separados) */
  async function handleDownloadCsv() {
    if (selectedSections.length === 0) {
      setMessage("Selecione ao menos uma seção para exportar.");
      setMessageType("error");
      return;
    }
    try {
      assertClinicaCanExport();
      const drivePayload = await fetchDriveBackupData();
      const csv = gerarCsvCompleto(drivePayload);
      await downloadBackupZip(csv, drivePayload);
      setMessage("Backup baixado (ZIP com CSV e arquivos JSON).");
      setMessageType("success");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Erro ao gerar backup");
      setMessageType("error");
    } finally {
      setBackupProgress(null);
    }
  }

  /** Fazer upload do CSV para o Google Drive */
  async function handleUploadToDrive() {
    if (selectedSections.length === 0) {
      setMessage("Selecione ao menos uma seção para exportar.");
      setMessageType("error");
      return;
    }
    setIsUploading(true);
    setMessage(null);

    try {
      assertClinicaCanExport();
      const drivePayload = await fetchDriveBackupData();
      const csv = gerarCsvCompleto(drivePayload);

      const extraFiles = buildBackupSectionJsonFiles(drivePayload);
      const stamp = new Date().toISOString().slice(0, 10);

      // Gerar JSON de pacientes (resumo agenda — legado)
      const pacientes = filteredEvents
        .filter((e) => e.patient)
        .map((e) => ({
          nome: e.patient ?? "",
          ultima_consulta: e.start?.toString() ?? "",
          servico: servicoDaConsulta(e),
          plano_convenio: planosDaConsulta(e).join(" | ") || null,
          tipo: e.tipoConsulta ?? null,
          status: e.status ?? null,
          valor: e.value ?? 0,
        }));
      const pacientesJson = JSON.stringify(
        { version: 1, exportado_em: new Date().toISOString(), pacientes },
        null,
        2,
      );

      // Gerar JSON de finanças
      const financasJson = JSON.stringify(
        {
          version: 1,
          exportado_em: new Date().toISOString(),
          total_entradas: faturamentoFinanceiro,
          total_saidas: despesasFinanceiro,
          saldo: faturamentoFinanceiro - despesasFinanceiro,
          transacoes: financeiro,
        },
        null,
        2,
      );

      const res = await fetch("/api/google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backup-csv",
          data: {
            content: csv,
            pacientesJson,
            financasJson,
            extraFiles,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.code === "PRONTUARIO_LOCKED") setShowPinModal(true);
        if (err.code === "PRONTUARIO_PIN_NOT_CONFIGURED") {
          throw new Error(
            err.error ||
              "Configure um PIN do prontuário em Meu Perfil antes de exportar backup.",
          );
        }
        throw new Error(err.error || "Erro ao enviar para Google Drive");
      }

      setMessage(
        `Backup enviado ao Google Drive (CSV + ${extraFiles.length + 2} arquivo(s) JSON).`,
      );
      setMessageType("success");

      await handleListDriveFiles();
    } catch (err: any) {
      setMessage(err.message);
      setMessageType("error");
    } finally {
      setIsUploading(false);
      setBackupProgress(null);
    }
  }

  /** Listar arquivos no Google Drive */
  async function handleListDriveFiles() {
    setIsLoadingDrive(true);
    try {
      const res = await fetch("/api/google-drive");
      if (!res.ok) {
        // Se der 403, é porque não está logado com Google
        if (res.status === 403) {
          setIsGoogleConnected(false);
          setDriveFiles([]);
          return;
        }
        throw new Error("Erro ao listar arquivos");
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
      setIsGoogleConnected(true);
    } catch {
      setDriveFiles([]);
    } finally {
      setIsLoadingDrive(false);
    }
  }

  useEffect(() => {
    handleListDriveFiles();
  }, []);

  /** Deletar arquivo do Google Drive */
  async function handleDeleteDriveFile(fileId: string) {
    if (!confirm("Remover este arquivo do Google Drive?")) return;
    try {
      const res = await fetch(
        `/api/google-drive?fileId=${encodeURIComponent(fileId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Erro ao remover");
      setMessage("Arquivo removido do Google Drive.");
      setMessageType("success");
      handleListDriveFiles();
    } catch (err: any) {
      setMessage(err.message);
      setMessageType("error");
    }
  }

  const fmt = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;

  if (clinicaAccessLoading) {
    return (
      <main className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <p className="text-sm text-slate-600">Carregando permissões de backup…</p>
      </main>
    );
  }

  if (clinicaNeedsPinSetup) {
    return (
      <main className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-4xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Backup — modo clínica
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">
            Configure o PIN do prontuário
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Contas de clínica precisam de um PIN do prontuário configurado em Meu Perfil
            antes de exportar qualquer backup (agenda, financeiro ou dados de pacientes).
          </p>
          <Link
            href="/dashboard/perfil"
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"
          >
            Configurar PIN em Perfil
          </Link>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm text-slate-500 hover:text-slate-800"
          >
            Voltar ao dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (clinicaModoRecepcaoBlock) {
    return (
      <main className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-4xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
            Modo recepção ativo
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">
            Backup indisponível
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Desative o modo recepção em Meu Perfil para exportar backup da clínica.
          </p>
          <Link
            href="/dashboard/perfil"
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800"
          >
            Ir para Perfil
          </Link>
        </div>
      </main>
    );
  }

  if (clinicaPinGate) {
    return (
      <main className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-4xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Backup — modo clínica
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">
            Acesso protegido por senha
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Contas de clínica precisam do PIN do prontuário desbloqueado para exportar
            backup (agenda, financeiro e dados de pacientes).
          </p>
          <button
            type="button"
            onClick={() => setShowPinModal(true)}
            className="mt-6 w-full rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"
          >
            Informar PIN do prontuário
          </button>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm text-slate-500 hover:text-slate-800"
          >
            Voltar ao dashboard
          </Link>
        </div>
        <ProntuarioPinModal
          open={showPinModal}
          onClose={() => setShowPinModal(false)}
          onUnlocked={() => {
            setShowPinModal(false);
            fetch("/api/prontuario-acesso/status")
              .then((r) => r.json())
              .then((data) => setProntuarioAccess(data))
              .catch(() => {});
          }}
          pinConfigured={prontuarioAccess?.pinConfigured ?? true}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-8 shadow-sm" data-tour="backup-header">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-800">
                Backup LGPD
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Seus dados, seu controle.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Exporte e armazene pacientes e faturamento no seu Google Drive.
                Nenhum dado de paciente fica no MedSupAPP.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Consultas
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">
              {countConsultas}
            </p>
            <p className="mt-2 text-sm text-slate-600">Registros na agenda.</p>
          </div>
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Pacientes
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">
              {pacientesUnicos}
            </p>
            <p className="mt-2 text-sm text-slate-600">Pacientes únicos.</p>
          </div>
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Receita (Agenda)
            </p>
            <p className="mt-4 text-3xl font-semibold text-emerald-600">
              {fmt(faturamentoTotal)}
            </p>
            <p className="mt-2 text-sm text-slate-600">Valor acumulado.</p>
          </div>
          <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Drive
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-950">
              {driveFiles.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Arquivos no Google Drive.
            </p>
          </div>
        </div>

        {/* Seções do backup */}
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                O que incluir no backup
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Marque todas as categorias que deseja exportar — nada fica de fora.
                {sensitiveSelected && prontuarioAccess?.locked && (
                  <span className="block text-amber-700 mt-1">
                    Dados clínicos selecionados: desbloqueie o PIN do prontuário.
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllSections}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Marcar todas
              </button>
              <button
                type="button"
                onClick={() => setSelectedSections([])}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500"
              >
                Limpar
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSections.map((section) => (
              <label
                key={section.id}
                className={`flex gap-3 rounded-2xl border p-3 cursor-pointer transition ${
                  selectedSections.includes(section.id)
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedSections.includes(section.id)}
                  onChange={() => toggleSection(section.id)}
                />
                <span>
                  <span className="text-sm font-medium text-slate-800 block">
                    {section.label}
                    {section.sensitive && (
                      <span className="ml-1 text-xs text-amber-700">(PIN)</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500">{section.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-8 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Filtros
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Aplique filtros para refinar os dados exportados no CSV e nos cards de resumo acima.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Fim
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="min-w-[200px]">
              <MultiSelect
                label="Paciente"
                options={pacientesOptions}
                selected={filterPacientes}
                searchable
                searchPlaceholder="Buscar paciente..."
                onChange={setFilterPacientes}
                placeholder="Todos os pacientes"
              />
            </div>
            <div className="min-w-[200px]">
              <MultiSelect
                label="Serviço"
                options={servicosOptions}
                selected={filterServicos}
                searchable
                searchPlaceholder="Buscar serviço..."
                onChange={setFilterServicos}
                placeholder="Todos os serviços"
              />
            </div>
            <div className="min-w-[220px]">
              <MultiSelect
                label="Plano / Convênio"
                options={planosOptions}
                selected={filterPlanos}
                searchable
                searchPlaceholder="Buscar plano..."
                onChange={setFilterPlanos}
                placeholder="Todos os planos"
              />
            </div>
            {!isMedico && medicosOptions.length > 0 && (
              <div className="min-w-[200px]">
                <MultiSelect
                  label="Médico (splits)"
                  options={medicosOptions}
                  selected={filterMedicos}
                  searchable
                  searchPlaceholder="Buscar médico..."
                  onChange={setFilterMedicos}
                  placeholder="Todos os médicos"
                />
              </div>
            )}
            {(startDate ||
              endDate ||
              filterPacientes.length > 0 ||
              filterServicos.length > 0 ||
              filterPlanos.length > 0 ||
              filterMedicos.length > 0) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setFilterPacientes([]);
                  setFilterServicos([]);
                  setFilterPlanos([]);
                  setFilterMedicos([]);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {(fetchingDriveData || backupProgress) && (
          <div className="mb-8 rounded-4xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  {backupProgress?.phase === "compactando"
                    ? "Compactando backup..."
                    : "Coletando dados do Drive..."}
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  {backupProgress?.detail ||
                    (patientCountForExport > BACKUP_ASYNC_PATIENT_THRESHOLD
                      ? "Exportação assíncrona para muitos pacientes"
                      : "Aguarde enquanto os arquivos são lidos")}
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-emerald-900">
                {backupProgress?.percent ?? 0}%
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
              <div
                className={`h-full rounded-full bg-emerald-600 transition-all duration-300 ${
                  fetchingDriveData && (backupProgress?.percent ?? 0) < 5
                    ? "animate-pulse w-full opacity-60"
                    : ""
                }`}
                style={
                  fetchingDriveData && (backupProgress?.percent ?? 0) < 5
                    ? undefined
                    : { width: `${Math.max(backupProgress?.percent ?? 5, 5)}%` }
                }
              />
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Coluna 1: Exportações */}
          <div className="space-y-6">
            {/* Exportar CSV */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                Exportar backup (ZIP)
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Gera um ZIP com CSV (consultas e financeiro tabular) e arquivos JSON
                separados para cada seção do Drive — sem JSON gigante dentro do CSV.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-500">
                <li>• Consultas com paciente, serviço, plano/convênio, tipo, status e valor</li>
                <li>• Resumo financeiro da agenda</li>
                <li>• Transações financeiras (entradas/saídas)</li>
                <li>• Splits por médico com porcentagens e valores</li>
                <li>• Totais: entradas, saídas e saldo</li>
              </ul>
              <button
                type="button"
                onClick={() => void handleDownloadCsv()}
                disabled={fetchingDriveData || selectedSections.length === 0}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
              >
                {fetchingDriveData || backupProgress
                  ? "Coletando dados..."
                  : `📥 Baixar ZIP (${selectedSections.length} seções)`}
              </button>
            </div>

            {/* Google Drive */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                    Google Drive
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {isGoogleConnected
                      ? "Seus dados de pacientes e finanças no seu Google Drive pessoal."
                      : "Faça login com Google para armazenar backups no seu Drive."}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${
                    isGoogleConnected
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isGoogleConnected ? "Conectado" : "Offline"}
                </span>
              </div>

              <button
                type="button"
                onClick={
                  isGoogleConnected
                    ? handleUploadToDrive
                    : handleConnectDrive
                }
                disabled={isUploading || isAuthorizing || fetchingDriveData || selectedSections.length === 0}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4285F4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3367d6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading || isAuthorizing ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {isUploading ? "Enviando..." : "Redirecionando..."}
                  </>
                ) : isGoogleConnected ? (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 87.3 78" fill="currentColor">
                      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/>
                      <path d="M43.65 25l-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5l16.15-28z" fill="#00AC47"/>
                      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 10.15 7.9 13.65z" fill="#EA4335"/>
                      <path d="M43.65 25l13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.4-4.5 1.2l13.75 23.8z" fill="#00832D"/>
                      <path d="M59.8 53l-16.15-28-16.15 28h32.3z" fill="#2684FC"/>
                      <path d="M73.55 76.8l-29.9-51.8-16.15 28h27.5c0 1.55.4 3.1 1.2 4.5l3.85 6.65 7.9 13.65 1.6 2.75c.8 1.4 2.35 1.9 3.8 1.05z" fill="#FFBA00"/>
                    </svg>
                    Enviar backup para Google Drive
                  </>
                ) : (
                  "Conectar Google Drive"
                )}
              </button>

              {isGoogleConnected && (
                <p className="mt-3 text-xs text-slate-400">
                  O backup será salvo na pasta "MedSupApp" do seu
                  Google Drive. Você controla seus dados.
                </p>
              )}
            </div>

            {/* Mensagem de feedback */}
            {message && (
              <div
                className={`rounded-4xl p-6 text-sm ${
                  messageType === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : messageType === "error"
                      ? "bg-red-50 text-red-600"
                      : "bg-blue-50 text-blue-700"
                }`}
              >
                {message}
              </div>
            )}
          </div>

          {/* Coluna 2: Arquivos no Google Drive + O que é exportado */}
          <div className="space-y-6">
            {/* Arquivos no Drive */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  Arquivos no Google Drive
                </p>
                <button
                  onClick={handleListDriveFiles}
                  disabled={isLoadingDrive}
                  className="rounded-xl px-3 py-1 text-xs text-blue-600 transition hover:bg-blue-50"
                >
                  {isLoadingDrive ? "..." : "↻ Atualizar"}
                </button>
              </div>

              <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                {driveFiles.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    {isGoogleConnected
                      ? "Nenhum arquivo de backup encontrado."
                      : "Conecte-se com Google para ver seus arquivos."}
                  </p>
                ) : (
                  driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {file.createdTime
                            ? new Date(file.createdTime).toLocaleDateString(
                                "pt-BR",
                              )
                            : ""}{" "}
                          · {file.mimeType?.includes("json") ? "JSON" : "CSV"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteDriveFile(file.id)}
                        className="ml-2 shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                        title="Remover"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* O que é exportado */}
            <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                O que é exportado
              </p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {visibleSections.map((s) => (
                  <li key={s.id} className="rounded-3xl bg-emerald-50 p-4">
                    <strong>{s.label}:</strong> {s.description}
                  </li>
                ))}
                <li className="rounded-3xl bg-emerald-50 p-4">
                  🔒 <strong>LGPD:</strong> dados salvos exclusivamente no seu Google
                  Drive. Modo clínica exige PIN do prontuário.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <ProntuarioPinModal
        open={showPinModal && !clinicaPinGate}
        onClose={() => setShowPinModal(false)}
        onUnlocked={() => {
          setShowPinModal(false);
          fetch("/api/prontuario-acesso/status")
            .then((r) => r.json())
            .then((data) => setProntuarioAccess(data))
            .catch(() => {});
        }}
        pinConfigured={prontuarioAccess?.pinConfigured ?? false}
      />
    </main>
  );
}