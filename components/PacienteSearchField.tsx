'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import type { PacienteOpcao } from '@/lib/types';
import { mergeOpcoesLista, selFromDriveId } from '@/lib/pacienteOpcoesUi';
import { fetchPacientesOpcoes } from '@/lib/pacientesOpcoesClient';
import { GOOGLE_CONTACTS_MIN_QUERY_LEN } from '@/lib/googleContacts';

type PacienteSearchFieldProps = {
  value: string;
  onChange: (sel: string, opt: PacienteOpcao | null) => void;
  clientesIniciais?: PacienteOpcao[];
  preselectDriveId?: string | null;
  label?: string;
  error?: string;
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
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);
  const [googleContatosOk, setGoogleContatosOk] = useState(false);
  const [buscarGoogle, setBuscarGoogle] = useState(false);
  const [driveConectado, setDriveConectado] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [hintBusca, setHintBusca] = useState<string | null>(null);
  const [cadastrosCarregados, setCadastrosCarregados] = useState(clientesIniciais.length > 0);
  const appliedPreselectRef = useRef(false);
  const clientesIniciaisRef = useRef(clientesIniciais);
  clientesIniciaisRef.current = clientesIniciais;

  const carregarCadastrados = useCallback(async (q?: string) => {
    const iniciais = clientesIniciaisRef.current;
    setLoadingOpcoes(true);
    try {
      const d = await fetchPacientesOpcoes({
        q,
        limit: q ? 40 : 500,
        google: false,
        force: !!q,
      });
      setOpcoes(mergeOpcoesLista(iniciais, d.opcoes));
      setGoogleContatosOk(!!d.google_contatos_disponivel);
      setDriveConectado(d.drive_conectado !== false);
      setAviso(d.aviso || null);
      setHintBusca(d.hint_busca_google ?? null);
      setCadastrosCarregados(true);
    } catch (err) {
      setAviso(
        err instanceof Error ? err.message : 'Não foi possível carregar pacientes cadastrados.',
      );
      if (iniciais.length > 0) {
        setOpcoes(iniciais);
        setCadastrosCarregados(true);
      }
    } finally {
      setLoadingOpcoes(false);
    }
  }, []);

  const buscarComGoogle = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < GOOGLE_CONTACTS_MIN_QUERY_LEN) {
        setAviso(
          `Digite pelo menos ${GOOGLE_CONTACTS_MIN_QUERY_LEN} caracteres e pressione Enter.`,
        );
        return;
      }
      setLoadingOpcoes(true);
      setAviso(null);
      try {
        const d = await fetchPacientesOpcoes({
          q: trimmed,
          limit: 30,
          google: true,
          force: true,
        });
        setOpcoes(mergeOpcoesLista(clientesIniciaisRef.current, d.opcoes));
        setGoogleContatosOk(!!d.google_contatos_disponivel);
        setDriveConectado(d.drive_conectado !== false);
        setAviso(d.aviso || null);
        setHintBusca(null);
      } catch (err) {
        setAviso(err instanceof Error ? err.message : 'Erro na busca.');
      } finally {
        setLoadingOpcoes(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (clientesIniciais.length === 0) return;
    setOpcoes((prev) => mergeOpcoesLista(clientesIniciais, prev));
    setCadastrosCarregados(true);
  }, [clientesIniciais]);

  useEffect(() => {
    appliedPreselectRef.current = false;
  }, [preselectDriveId]);

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
          o.origem === 'google' ? 'Google Contatos' : 'Cadastro',
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

  const handleDropdownOpen = useCallback(() => {
    if (!cadastrosCarregados && clientesIniciaisRef.current.length === 0) {
      void carregarCadastrados();
    }
  }, [cadastrosCarregados, carregarCadastrados]);

  const handleSearchSubmit = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (buscarGoogle) {
        void buscarComGoogle(trimmed);
        return;
      }
      if (trimmed.length > 0) {
        void carregarCadastrados(trimmed);
      }
    },
    [buscarGoogle, buscarComGoogle, carregarCadastrados],
  );

  const placeholder = loadingOpcoes
    ? 'Carregando...'
    : cadastrosCarregados
      ? 'Selecione ou busque paciente...'
      : 'Abra para carregar pacientes cadastrados';

  return (
    <div className="space-y-3">
      {googleContatosOk && (
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={buscarGoogle}
            onChange={(e) => setBuscarGoogle(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-emerald-600"
          />
          <span>
            Buscar nos <strong>Contatos Google</strong> (pressione Enter na busca após marcar)
          </span>
        </label>
      )}

      <SearchableSelect
        label={label}
        options={clienteOptions}
        value={value}
        onChange={handleSelect}
        placeholder={placeholder}
        searchPlaceholder={
          buscarGoogle
            ? 'Nome e Enter para buscar no Google...'
            : 'Filtrar cadastrados ou Enter para buscar...'
        }
        disabled={false}
        error={error}
        dropdownMode="fixed"
        listMaxHeight="max-h-80"
        onDropdownOpen={handleDropdownOpen}
        onSearchSubmit={handleSearchSubmit}
        largeListThreshold={30}
        maxVisibleOptions={80}
        emptyMessage={
          loadingOpcoes
            ? 'Carregando...'
            : buscarGoogle
              ? `Pressione Enter com ${GOOGLE_CONTACTS_MIN_QUERY_LEN}+ caracteres para buscar no Google.`
              : 'Nenhum paciente cadastrado encontrado. Digite o nome abaixo ou busque com Enter.'
        }
      />

      {aviso && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{aviso}</p>
      )}

      {hintBusca && !buscarGoogle && (
        <p className="text-xs text-gray-500">{hintBusca}</p>
      )}

      {!googleContatosOk && !loadingOpcoes && driveConectado && (
        <p className="text-xs text-gray-500">
          Autorize os Contatos Google em Pacientes para buscar na agenda Google.
        </p>
      )}

      {pacienteSelecionado && (
        <div className="rounded-xl border border-emerald-200/50 bg-emerald-50 px-4 py-3 text-sm space-y-1">
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
              ? 'Será cadastrado automaticamente ao salvar, se ainda não existir.'
              : 'Paciente cadastrado'}
          </p>
        </div>
      )}

      {onManualNameChange && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {value ? 'Nome (ajuste se necessário)' : 'Nome do paciente *'}
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
          {!value && (
            <p className="text-xs text-gray-500 mt-1">
              Se não achar na lista, digite o nome — ao salvar criamos o cadastro no Drive.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
