'use client';

import { useMemo, useState } from 'react';
import { GitMerge, Loader2, X } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import type { Cliente } from '@/lib/types';

type UnificarCadastrosModalProps = {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
  onUnificado: (principalId: string) => void;
  disabled?: boolean;
};

export default function UnificarCadastrosModal({
  open,
  onClose,
  clientes,
  onUnificado,
  disabled = false,
}: UnificarCadastrosModalProps) {
  const [principalId, setPrincipalId] = useState('');
  const [secundarioId, setSecundarioId] = useState('');
  const [unificando, setUnificando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const options = useMemo(
    () =>
      clientes.map((c) => ({
        value: c.id,
        label: c.nome,
        sublabel: [c.telefone, c.convenio].filter(Boolean).join(' · ') || 'Sem telefone',
      })),
    [clientes],
  );

  const principal = clientes.find((c) => c.id === principalId);
  const secundario = clientes.find((c) => c.id === secundarioId);

  function fechar() {
    setPrincipalId('');
    setSecundarioId('');
    setErro(null);
    onClose();
  }

  async function unificar() {
    if (!principalId || !secundarioId) {
      setErro('Selecione os dois cadastros.');
      return;
    }
    if (principalId === secundarioId) {
      setErro('Selecione dois cadastros diferentes.');
      return;
    }
    if (
      !confirm(
        `Unificar "${secundario?.nome ?? 'cadastro'}" em "${principal?.nome ?? 'cadastro'}"?\n\nO cadastro secundário será removido e todo o histórico passará para o principal.`,
      )
    ) {
      return;
    }

    setUnificando(true);
    setErro(null);
    try {
      const res = await fetch('/api/clientes/unificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principalId, secundarioId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao unificar');
      onUnificado(principalId);
      fechar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao unificar');
    } finally {
      setUnificando(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar"
        onClick={fechar}
      />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900">Unificar cadastros</h2>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600">
            Escolha o cadastro que ficará (principal) e o que será absorvido (importado, Google ou
            duplicado). Atendimentos, observações e pagamentos do secundário passam para o principal.
          </p>

          {clientes.length < 2 ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
              É necessário ter pelo menos dois pacientes cadastrados para unificar.
            </p>
          ) : (
            <>
              <SearchableSelect
                label="Cadastro principal (manter)"
                options={options.filter((o) => o.value !== secundarioId)}
                value={principalId}
                onChange={setPrincipalId}
                placeholder="Selecione o paciente principal..."
                searchPlaceholder="Buscar paciente..."
                disabled={disabled || unificando}
                dropdownMode="fixed"
              />

              <SearchableSelect
                label="Cadastro a unificar (será removido)"
                options={options.filter((o) => o.value !== principalId)}
                value={secundarioId}
                onChange={setSecundarioId}
                placeholder="Selecione o cadastro duplicado..."
                searchPlaceholder="Buscar paciente..."
                disabled={disabled || unificando}
                dropdownMode="fixed"
              />

              {principal && secundario && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm space-y-1">
                  <p className="font-medium text-gray-900">Resumo</p>
                  <p className="text-gray-700">
                    <span className="text-emerald-700 font-medium">{secundario.nome}</span>
                    {' → '}
                    <span className="text-emerald-700 font-medium">{principal.nome}</span>
                  </p>
                </div>
              )}
            </>
          )}

          {erro && (
            <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">{erro}</p>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={fechar}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void unificar()}
            disabled={
              disabled || unificando || clientes.length < 2 || !principalId || !secundarioId
            }
            className="flex-1 py-3 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {unificando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Unificando...
              </>
            ) : (
              'Unificar cadastros'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
