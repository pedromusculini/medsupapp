"use client";

import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileUp, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  formatBytesLimit,
  PRONTUARIO_CSV_MAX_BYTES_UI,
  PRONTUARIO_CSV_MAX_DATA_ROWS_UI,
  PRONTUARIO_CSV_ROUTE_TIMEOUT_CODE,
  PRONTUARIO_CSV_TOO_LARGE_CODE,
} from "@/lib/prontuarioCsvLimits";

type PreviewRow = {
  id: string;
  data: string;
  hora: string | null;
  medico: string | null;
  texto: string;
  tipo: string | null;
  campos: Record<string, number | string | null>;
};

type CsvPreview = {
  layout: string;
  delimiter: string;
  headers: string[];
  totalLinhas: number;
  totalLinhasArquivo?: number;
  linhasTruncadas?: boolean;
  previewRows: PreviewRow[];
  erros: { linha: number; motivo: string }[];
  avisos: string[];
  entradasValidas: number;
  entradasInvalidas: number;
};

type ImportResult = {
  importadas: number;
  duplicadas: number;
  ignoradas: number;
  erros: { linha: number; motivo: string }[];
  backup: string | null;
  totalEntradas: number;
};

type Props = {
  clienteId: string;
  disabled?: boolean;
  onImported?: () => void;
  compact?: boolean;
};

function formatDataIso(data: string, hora: string | null): string {
  try {
    const d = parseISO(data);
    const base = format(d, "dd/MM/yyyy", { locale: ptBR });
    return hora ? `${base} ${hora.slice(0, 5)}` : base;
  } catch {
    return data;
  }
}

export default function ProntuarioCsvImportPanel({
  clienteId,
  disabled = false,
  onImported,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [existingCount, setExistingCount] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showModeChoice, setShowModeChoice] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    window.open(`/api/clientes/${encodeURIComponent(clienteId)}/prontuario/csv-template`, "_blank");
  }

  function csvApiErrorMessage(data: { error?: string; code?: string }, status: number): string {
    if (data.code === PRONTUARIO_CSV_TOO_LARGE_CODE || status === 413) {
      return (
        data.error ??
        `Arquivo muito grande. O limite é ${formatBytesLimit(PRONTUARIO_CSV_MAX_BYTES_UI)}.`
      );
    }
    if (data.code === PRONTUARIO_CSV_ROUTE_TIMEOUT_CODE || status === 504) {
      return (
        data.error ??
        "A análise demorou demais. Use um arquivo menor ou divida o CSV em partes."
      );
    }
    return data.error ?? "Erro ao processar CSV";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImportResult(null);

    if (file.size > PRONTUARIO_CSV_MAX_BYTES_UI) {
      setError(
        `Arquivo muito grande (${formatBytesLimit(file.size)}). O limite é ${formatBytesLimit(PRONTUARIO_CSV_MAX_BYTES_UI)} — divida o CSV em partes menores.`,
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/clientes/${encodeURIComponent(clienteId)}/prontuario/import-csv/preview`,
        { method: "POST", body: form },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(csvApiErrorMessage(data, res.status));

      setPreview(data.preview);
      setHasExisting(data.hasExisting);
      setExistingCount(data.existingCount ?? 0);
      setPendingFile(file);
      setShowPreview(true);
      setShowModeChoice(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar CSV");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function commitImport(mode: "append" | "replace") {
    if (!pendingFile) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", pendingFile);
      form.append("mode", mode);
      const res = await fetch(
        `/api/clientes/${encodeURIComponent(clienteId)}/prontuario/import-csv`,
        { method: "POST", body: form },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(csvApiErrorMessage(data, res.status));

      setImportResult(data.result);
      setShowPreview(false);
      setShowModeChoice(false);
      setPendingFile(null);
      setPreview(null);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar");
    } finally {
      setLoading(false);
    }
  }

  function confirmPreview() {
    if (hasExisting) {
      setShowModeChoice(true);
    } else {
      void commitImport("append");
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "pt-1"}`}>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Baixar modelo CSV
        </button>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
          Importar CSV
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />
      </div>

      {!compact && (
        <p className="text-xs text-gray-500">
          UTF-8 com BOM, separador ponto-e-vírgula (;). Aceita exportações de Excel, iClinic e outros
          sistemas — o parser detecta colunas automaticamente. Limite:{" "}
          {formatBytesLimit(PRONTUARIO_CSV_MAX_BYTES_UI)} e até{" "}
          {PRONTUARIO_CSV_MAX_DATA_ROWS_UI.toLocaleString("pt-BR")} linhas de dados por importação
          (arquivos maiores são truncados com aviso na pré-visualização).
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {importResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-1">
          <p className="font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Importação concluída
          </p>
          <p>{importResult.importadas} evolução(ões) importada(s)</p>
          {importResult.duplicadas > 0 && (
            <p>{importResult.duplicadas} duplicata(s) ignorada(s)</p>
          )}
          {importResult.ignoradas > 0 && (
            <p>{importResult.ignoradas} linha(s) com erro ignorada(s)</p>
          )}
          <p>Total no prontuário: {importResult.totalEntradas}</p>
          <p className="text-emerald-800 text-xs pt-1">
            Dados salvos no Google Drive. Abra a aba <strong>Prontuário</strong> para ver evoluções e
            gráficos clínicos (confira data de nascimento e sexo no cadastro para curvas OMS).
          </p>
          {importResult.backup && (
            <p className="text-emerald-800">Backup salvo: {importResult.backup}</p>
          )}
        </div>
      )}

      {showPreview && preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b">
              <h4 className="text-lg font-semibold">Pré-visualização do import</h4>
              <p className="text-sm text-gray-500 mt-1">
                {preview.entradasValidas} evolução(ões) válida(s) ·{" "}
                {preview.linhasTruncadas && preview.totalLinhasArquivo != null
                  ? `${preview.totalLinhas.toLocaleString("pt-BR")} de ${preview.totalLinhasArquivo.toLocaleString("pt-BR")} linha(s) analisadas`
                  : `${preview.totalLinhas.toLocaleString("pt-BR")} linha(s) no arquivo`}{" "}
                · layout {preview.layout}
              </p>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {preview.linhasTruncadas && (
                <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-sm text-amber-950">
                  <p className="font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Arquivo parcialmente analisado
                  </p>
                  <p className="mt-1">
                    Só as primeiras {preview.totalLinhas.toLocaleString("pt-BR")} linhas foram
                    processadas. A importação confirmada incluirá apenas esse trecho — divida o CSV
                    para trazer o histórico completo.
                  </p>
                </div>
              )}
              {preview.avisos.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                  {preview.avisos.map((a) => (
                    <p key={a}>{a}</p>
                  ))}
                </div>
              )}
              {preview.previewRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-3">Data</th>
                        <th className="py-2 pr-3">Médico</th>
                        <th className="py-2 pr-3">Texto</th>
                        <th className="py-2">Medidas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.previewRows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-100 align-top">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {formatDataIso(row.data, row.hora)}
                          </td>
                          <td className="py-2 pr-3 text-gray-600">{row.medico ?? "—"}</td>
                          <td className="py-2 pr-3 max-w-xs">
                            <span className="line-clamp-3">{row.texto || "—"}</span>
                          </td>
                          <td className="py-2 text-xs text-gray-500">
                            {Object.keys(row.campos ?? {}).length > 0
                              ? Object.entries(row.campos)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(", ")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.entradasValidas > preview.previewRows.length && (
                    <p className="text-xs text-gray-400 mt-2">
                      Mostrando {preview.previewRows.length} de {preview.entradasValidas} entradas.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Nenhuma evolução válida detectada.</p>
              )}
              {preview.erros.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-800">
                  <p className="font-medium mb-1">Linhas com erro ({preview.erros.length})</p>
                  <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                    {preview.erros.slice(0, 20).map((e) => (
                      <li key={`${e.linha}-${e.motivo}`}>
                        Linha {e.linha}: {e.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="p-5 border-t flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setShowPreview(false);
                  setShowModeChoice(false);
                  setPendingFile(null);
                }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm"
              >
                Cancelar
              </button>
              {!showModeChoice ? (
                <button
                  type="button"
                  disabled={loading || preview.entradasValidas === 0}
                  onClick={confirmPreview}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
                >
                  {loading ? "Importando..." : "Confirmar importação"}
                </button>
              ) : (
                <>
                  <p className="w-full text-sm text-gray-600 mb-1">
                    Já existem {existingCount} evolução(ões) neste paciente. O que deseja fazer?
                  </p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void commitImport("append")}
                    className="px-4 py-2 rounded-lg border border-emerald-700 text-emerald-800 text-sm font-medium"
                  >
                    Acrescentar
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      if (
                        confirm(
                          "Substituir todo o histórico importado? Um backup será salvo automaticamente no Drive.",
                        )
                      ) {
                        void commitImport("replace");
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium"
                  >
                    Substituir tudo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
