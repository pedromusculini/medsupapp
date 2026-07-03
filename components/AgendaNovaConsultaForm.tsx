'use client';

import { memo, useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import PacienteSearchField from '@/components/PacienteSearchField';
import PhoneInput, { phoneValueForInput } from '@/components/PhoneInput';
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/phone';
import { ensurePacienteCliente } from '@/lib/ensurePacienteClienteClient';
import ConvenioSelect from '@/components/ConvenioSelect';
import MedicoSelect from '@/components/MedicoSelect';
import {
  resolveMedicoValue,
  validateMedicoSelection,
} from '@/lib/loadMedicosOptions';
import type { PacienteOpcao } from '@/lib/types';
import {
  datetimeLocalMaisMinutos,
  toDatetimeLocalValue,
} from '@/lib/consultations';

export type AgendaNovaConsultaSubmitData = {
  patientName: string;
  service: string;
  value: number;
  start: Date;
  end: Date;
  location?: string;
  telefone: string;
  lembretesWhatsapp: boolean;
  medicoNome?: string;
  convenio?: string;
  observacoes?: string;
};

type Props = {
  clientesIniciais: PacienteOpcao[];
  medicosOptions: string[];
  isClinica: boolean;
  defaultLocation: string;
  isGoogleConnected: boolean;
  onReloadClientes: () => Promise<void>;
  /** Parent cria o evento e roda o sync — não alterar essa lógica no parent. */
  onSubmitConsulta: (data: AgendaNovaConsultaSubmitData) => Promise<void>;
};

function defaultStartEnd() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(8, 0, 0, 0);
  const start = toDatetimeLocalValue(amanha);
  return { start, end: datetimeLocalMaisMinutos(start) };
}

function AgendaNovaConsultaForm({
  clientesIniciais,
  medicosOptions,
  isClinica,
  defaultLocation,
  isGoogleConnected,
  onReloadClientes,
  onSubmitConsulta,
}: Props) {
  const [patient, setPatient] = useState('');
  const [service, setService] = useState('Consulta médica');
  const [value, setValue] = useState(200);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [formPacienteSel, setFormPacienteSel] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formConvenio, setFormConvenio] = useState('');
  const [formLembretes, setFormLembretes] = useState(true);
  const [formErro, setFormErro] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMedico, setFormMedico] = useState('');

  useEffect(() => {
    const defaults = defaultStartEnd();
    setStart(defaults.start);
    setEnd(defaults.end);
  }, []);

  useEffect(() => {
    if (medicosOptions.length === 1 && !formMedico) {
      setFormMedico(medicosOptions[0]);
    }
  }, [medicosOptions, formMedico]);

  const resetFields = () => {
    setPatient('');
    setFormPacienteSel('');
    setFormTelefone('');
    setFormConvenio('');
    setObservacoes('');
    setLocation('');
    setService('Consulta médica');
    setFormErro(null);
    const defaults = defaultStartEnd();
    setStart(defaults.start);
    setEnd(defaults.end);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formSubmitting) return;
    setFormErro(null);

    if (!patient.trim() && !formPacienteSel) {
      setFormErro('Selecione um paciente na lista ou informe o nome.');
      return;
    }
    if (!start || !end) {
      setFormErro('Informe início e fim da consulta.');
      return;
    }
    if (!isValidPhone(formTelefone)) {
      setFormErro(PHONE_VALIDATION_MESSAGE);
      return;
    }
    const medicoErr = validateMedicoSelection(
      medicosOptions,
      formMedico,
      isClinica,
    );
    if (medicoErr) {
      setFormErro(medicoErr);
      return;
    }

    setFormSubmitting(true);
    try {
      let patientName = patient.trim();
      try {
        const resolved = await ensurePacienteCliente({
          nome: patientName,
          telefone: formTelefone.trim(),
          paciente_sel: formPacienteSel,
        });
        patientName = resolved.nome;
        await onReloadClientes();
      } catch (err) {
        setFormErro(
          err instanceof Error ? err.message : 'Erro ao cadastrar paciente',
        );
        return;
      }

      const medicoNome = resolveMedicoValue(medicosOptions, formMedico);
      await onSubmitConsulta({
        patientName,
        service,
        value,
        start: new Date(start),
        end: new Date(end),
        location: location || defaultLocation || undefined,
        telefone: formTelefone.trim(),
        lembretesWhatsapp: formLembretes,
        medicoNome: medicoNome || undefined,
        convenio: formConvenio || undefined,
        observacoes: observacoes || undefined,
      });
      resetFields();
    } catch (err) {
      setFormErro(
        err instanceof Error ? err.message : 'Erro ao salvar consulta',
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div
      id="nova-consulta-form"
      className="rounded-2xl sm:rounded-4xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm scroll-mt-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-emerald-800">
            Nova consulta
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Ou clique na grade do calendário para abrir o formulário de agendamento.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {formErro && (
          <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
            {formErro}
          </p>
        )}
        <PacienteSearchField
          value={formPacienteSel}
          onChange={(sel, opt) => {
            setFormPacienteSel(sel);
            if (opt) {
              setPatient(opt.nome);
              if (opt.telefone) setFormTelefone(phoneValueForInput(opt.telefone));
              if (opt.convenio) setFormConvenio(opt.convenio);
            } else setPatient('');
          }}
          clientesIniciais={clientesIniciais}
          manualName={patient}
          onManualNameChange={setPatient}
        />
        <label className="space-y-2 text-sm text-slate-700 min-w-0 block">
          WhatsApp *
          <PhoneInput
            value={formTelefone}
            onChange={setFormTelefone}
            showIcon={false}
            className="min-w-0"
            inputClassName="rounded-2xl sm:rounded-3xl border-slate-200 bg-slate-50 text-base sm:text-sm text-slate-900"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={formLembretes}
            onChange={(e) => setFormLembretes(e.target.checked)}
            className="mt-1 rounded border-slate-300 text-emerald-600"
          />
          <span>Incluir nos lembretes WhatsApp do Dashboard</span>
        </label>
        <label className="space-y-2 text-sm text-slate-700 min-w-0 block">
          Serviço *
          <input
            required
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-emerald-200"
            placeholder="Ex: Consulta, Retorno"
          />
        </label>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700 min-w-0">
            Início *
            <input
              required
              type="datetime-local"
              value={start}
              onChange={(e) => {
                const v = e.target.value;
                setStart(v);
                if (v) setEnd(datetimeLocalMaisMinutos(v));
              }}
              className="w-full min-w-0 max-w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-emerald-200"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-700 min-w-0">
            Fim *
            <input
              required
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full min-w-0 max-w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-emerald-200"
            />
          </label>
        </div>
        <label className="space-y-2 text-sm text-slate-700 min-w-0">
          Valor (R$)
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-emerald-200"
          />
        </label>
        <MedicoSelect
          medicos={medicosOptions}
          isClinica={isClinica}
          value={formMedico}
          onChange={setFormMedico}
          label="Médico"
          className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900"
        />
        <ConvenioSelect
          value={formConvenio}
          onChange={setFormConvenio}
          label="Plano / convênio"
          allowEmpty
          emptyLabel="Particular ou não informado"
          className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900"
        />
        <label className="space-y-2 text-sm text-slate-700 min-w-0">
          Endereço
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Rua, número, bairro - Cidade/UF"
            className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-emerald-200"
          />
          {location && isGoogleConnected && (
            <p className="text-xs text-blue-500">
              🗺️ O endereço será incluído como link do Google Maps no evento.
            </p>
          )}
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          Observações
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Notas adicionais para o evento..."
            className="w-full min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm text-slate-900 outline-none focus:border-emerald-200"
          />
        </label>
        <button
          type="submit"
          disabled={formSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-200 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 touch-manipulation disabled:opacity-60 disabled:pointer-events-none"
        >
          {formSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Salvando...
            </>
          ) : isGoogleConnected ? (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#4285F4">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
              </svg>
              Salvar no Google Calendar
            </>
          ) : (
            'Salvar consulta'
          )}
        </button>
      </form>
    </div>
  );
}

export default memo(AgendaNovaConsultaForm);
