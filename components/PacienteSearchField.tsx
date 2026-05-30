'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import type { PacienteOpcao } from '@/lib/types';
import { mergeOpcoesLista, selFromDriveId } from '@/lib/pacienteOpcoesUi';

type PacienteSearchFieldProps = {
  value: string;
  onChange: (sel: string, opt: PacienteOpcao | null) => void;
  clientesIniciais?: PacienteOpcao[];
  preselectDriveId?: string | null;
  label?: string;
  error?: string;
  /** Nome digitado quando o paciente não está na lista */
  manualName?: string;
  onManualNameChange?: (nome: string) => void;
  manualNameError?: string;
};

export default function PacienteSearchField({
  value,
  onChange,
  clientesIniciais = [],
  preselectDriveId = null,
  label = 'Paciente *',
  error,
  manualName = '',
  onManualNameChange,
  manualNameError,
}: PacienteSearchFieldProps) {
  const [opcoes, setOpcoes] = useState<PacienteOpcao[]>(clientesIniciais);
  const [loadingOpcoes, setLoadingOpcoes] = useState(clientesIniciais.length === 0);
  const [googleContatosOk, setGoogleContatosOk] = useState(false);
  const appliedPreselectRef = useRef(false);

  const loadOpcoes = useCallback(async () => {
    setLoadingOpcoes(true);
    try {
      const res = await fetch('/api/clientes/pacientes-opcoes');
      const d = await res.json();
      if (res.ok) {
        setOpcoes(mergeOpcoesLista(clientesIniciais, d.opcoes || []));
        setGoogleContatosOk(!!d.google_contatos_disponivel);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingOpcoes(false);
    }
  }, [clientesIniciais]);

  useEffect(() => {
    setOpcoes((prev) => mergeOpcoesLista(clientesIniciais, prev));
  }, [clientesIniciais]);

  useEffect(() => {
    void loadOpcoes();
  }, [loadOpcoes]);

  useEffect(() => {
    if (!preselectDriveId || appliedPreselectRef.current) return;
    const sel = selFromDriveId(preselectDriveId);
    const opt = opcoes.find((o) => o.id === sel);
    if (opt) {
      appliedPreselectRef.current = true;
      onChange(sel, opt);
    }
  }, [preselectDriveId, opcoes, onChange]);

  const clienteOptions = useMemo(
    () =>
      opcoes.map((o) => ({
        value: o.id,
        label: o.nome,
        sublabel: [
          o.telefone,
          o.convenio,
          o.origem === 'google' ? 'Google Contatos' : 'Cliente',
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [opcoes],
  );

  const pacienteSelecionado = useMemo(
    () => opcoes.find((o) => o.id === value) ?? null,
    [opcoes, value],
  );

  function handleSelect(sel: string) {
    const opt = opcoes.find((o) => o.id === sel) ?? null;
    onChange(sel, opt);
  }

  return (
    <div className="space-y-3">
      <SearchableSelect
        label={label}
        options={clienteOptions}
        value={value}
        onChange={handleSelect}
        placeholder={
          loadingOpcoes && opcoes.length === 0
            ? 'Carregando clientes...'
            : 'Toque para buscar na lista...'
        }
        searchPlaceholder="Nome, telefone ou e-mail..."
        disabled={loadingOpcoes && opcoes.length === 0}
        error={error}
        dropdownMode="fixed"
        listMaxHeight="max-h-80"
      />
      {googleContatosOk ? (
        <p className="text-xs text-[#228B22]">
          Contatos Google incluídos — telefone e dados preenchem ao selecionar.
        </p>
      ) : (
        !loadingOpcoes && (
          <p className="text-xs text-gray-500">
            Conecte os Contatos Google no Dashboard para buscar também na agenda do
            Google.
          </p>
        )
      )}

      {pacienteSelecionado && (
        <div className="rounded-xl border border-[#90EE90]/50 bg-[#fafffa] px-4 py-3 text-sm space-y-1">
          <p className="font-semibold text-gray-900">{pacienteSelecionado.nome}</p>
          {pacienteSelecionado.telefone && (
            <p className="text-gray-600">
              WhatsApp:{' '}
              <span className="font-medium">{pacienteSelecionado.telefone}</span>
            </p>
          )}
          {pacienteSelecionado.convenio && (
            <p className="text-gray-600">Convênio: {pacienteSelecionado.convenio}</p>
          )}
          {pacienteSelecionado.email && (
            <p className="text-gray-600 truncate">E-mail: {pacienteSelecionado.email}</p>
          )}
          <p className="text-xs text-gray-400 pt-0.5">
            {pacienteSelecionado.origem === 'google'
              ? 'Contato Google'
              : 'Cliente cadastrado'}
          </p>
        </div>
      )}

      {!value && onManualNameChange && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome (se não estiver na lista)
          </label>
          <input
            type="text"
            value={manualName}
            onChange={(e) => onManualNameChange(e.target.value)}
            placeholder="Ex: Maria Silva"
            className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
              manualNameError ? 'border-red-400 bg-red-50' : 'border-gray-200'
            }`}
          />
          {manualNameError && (
            <p className="text-xs text-red-600 mt-1">{manualNameError}</p>
          )}
        </div>
      )}
    </div>
  );
}
