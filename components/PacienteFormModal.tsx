'use client';

import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  MOBILE_MODAL_OVERLAY,
  MOBILE_MODAL_SHEET,
  useBodyScrollLock,
} from '@/lib/useBodyScrollLock';
import PhoneInput, { phoneValueForInput } from '@/components/PhoneInput';
import ConvenioSelect from '@/components/ConvenioSelect';
import ProntuarioCsvImportPanel from '@/components/ProntuarioCsvImportPanel';
import type { Cliente } from '@/lib/types';

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  data_nascimento: string;
  sexo: string;
  convenio: string;
  observacoes_gerais: string;
};

const emptyForm: FormState = {
  nome: '',
  email: '',
  telefone: '',
  cpf: '',
  data_nascimento: '',
  sexo: '',
  convenio: '',
  observacoes_gerais: '',
};

function seedToForm(seed: Cliente | null): FormState {
  if (!seed) return emptyForm;
  return {
    nome: seed.nome,
    email: seed.email ?? '',
    telefone: phoneValueForInput(seed.telefone),
    cpf: seed.cpf ?? '',
    data_nascimento: seed.data_nascimento ?? '',
    sexo: seed.sexo ?? '',
    convenio: seed.convenio ?? '',
    observacoes_gerais: seed.observacoes_gerais ?? '',
  };
}

type ProntuarioAccess = {
  locked?: boolean;
  modoRecepcao?: boolean;
} | null;

type Props = {
  open: boolean;
  editingClienteId: string | null;
  seed: Cliente | null;
  prontuarioAccess: ProntuarioAccess;
  onClose: () => void;
  onSaved: (result: { id: string; editing: boolean }) => void | Promise<void>;
  onCsvImported: (clienteId: string) => void;
};

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

function PacienteFormModal({
  open,
  editingClienteId,
  seed,
  prontuarioAccess,
  onClose,
  onSaved,
  onCsvImported,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setForm(seedToForm(seed));
    setSaving(false);
    setSavedOk(!!editingClienteId);
    setActiveId(editingClienteId);
  }, [open, editingClienteId, seed]);

  if (!open || typeof document === 'undefined') return null;

  const patch = (partial: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = activeId ? `/api/clientes/${activeId}` : '/api/clientes';
      const method = activeId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      const savedId = (data.cliente?.id as string | undefined) ?? activeId;
      if (savedId) {
        setActiveId(savedId);
        setSavedOk(true);
        await onSaved({ id: savedId, editing: !!editingClienteId });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className={MOBILE_MODAL_OVERLAY}>
      <div className={MOBILE_MODAL_SHEET}>
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold">
            {activeId ? 'Editar paciente' : 'Novo paciente'}
          </h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Nome *" id="nome">
            <input
              id="nome"
              required
              value={form.nome}
              onChange={(e) => patch({ nome: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefone / WhatsApp" id="tel">
              <PhoneInput
                id="tel"
                value={form.telefone}
                onChange={(v) => patch({ telefone: v })}
              />
            </Field>
            <Field label="E-mail" id="email">
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="CPF" id="cpf">
              <input
                id="cpf"
                value={form.cpf}
                onChange={(e) => patch({ cpf: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </Field>
            <Field label="Nascimento" id="nasc">
              <input
                id="nasc"
                type="date"
                value={form.data_nascimento}
                onChange={(e) => patch({ data_nascimento: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </Field>
          </div>
          <Field label="Sexo (gráficos OMS)" id="sexo">
            <select
              id="sexo"
              value={form.sexo}
              onChange={(e) => patch({ sexo: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
            >
              <option value="">Não informado</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
            </select>
          </Field>
          <ConvenioSelect
            value={form.convenio}
            onChange={(convenio) => patch({ convenio })}
            label="Convênio do paciente"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <Field label="Observações gerais" id="obs">
            <textarea
              id="obs"
              rows={3}
              value={form.observacoes_gerais}
              onChange={(e) => patch({ observacoes_gerais: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </Field>
          {savedOk && activeId && !prontuarioAccess?.modoRecepcao && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-800 mb-2">
                Importar prontuário (CSV)
              </p>
              <ProntuarioCsvImportPanel
                clienteId={activeId}
                compact
                disabled={prontuarioAccess?.locked ?? false}
                onImported={() => onCsvImported(activeId)}
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
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200"
            >
              {savedOk ? 'Fechar' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-emerald-700 text-white font-medium disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default memo(PacienteFormModal);
