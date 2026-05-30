'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, CalendarPlus, User, RotateCcw, AlertCircle, Phone } from 'lucide-react';
import { aplicarMascaraWhatsapp } from '@/lib/constants';
import { format } from 'date-fns';
import ConvenioSelect from '@/components/ConvenioSelect';
import SearchableSelect from '@/components/SearchableSelect';
import {
  classificarTipoConsulta,
  DIAS_RETORNO,
  DURACAO_CONSULTA_MIN,
  horaMaisMinutos,
  type ConsultationRecord,
} from '@/lib/consultations';
import { ATENDIMENTO_LABEL } from '@/lib/constants';

export type AgendaConsultaPayload = {
  patient: string;
  service: string;
  start: Date;
  end: Date;
  value: number;
  location: string;
  convenio: string;
  medico: string;
  observacoes: string;
  telefone?: string;
  lembretesWhatsapp?: boolean;
  editingId?: string | null;
};

type FieldErrors = Partial<
  Record<'patient' | 'data' | 'horaInicio' | 'horaFim' | 'medico' | 'service', string>
>;

export type AgendaClienteOption = {
  id: string;
  nome: string;
  telefone?: string | null;
  convenio?: string | null;
};

type AgendaConsultaModalProps = {
  open: boolean;
  slotStart: Date;
  slotEnd: Date;
  editingEvent?: ConsultationRecord | null;
  allEvents: ConsultationRecord[];
  isClinica?: boolean;
  medicos?: string[];
  defaultLocation?: string;
  saving?: boolean;
  clientes?: AgendaClienteOption[];
  initialClienteId?: string | null;
  onClose: () => void;
  onConfirm: (payload: AgendaConsultaPayload) => void | Promise<void>;
};

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border px-3 py-2.5 text-sm ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-200'
  }`;
}

export default function AgendaConsultaModal({
  open,
  slotStart,
  slotEnd,
  editingEvent = null,
  allEvents,
  isClinica = false,
  medicos = [],
  defaultLocation = '',
  saving = false,
  clientes = [],
  initialClienteId = null,
  onClose,
  onConfirm,
}: AgendaConsultaModalProps) {
  const isEdit = !!editingEvent?.id;
  const useClienteSelect = clientes.length > 0 && !isEdit;

  const [patientClienteId, setPatientClienteId] = useState('');
  const [patient, setPatient] = useState('');
  const [service, setService] = useState('Consulta médica');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [value, setValue] = useState('200');
  const [location, setLocation] = useState('');
  const [convenio, setConvenio] = useState('');
  const [medico, setMedico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [telefone, setTelefone] = useState('');
  const [lembretesWhatsapp, setLembretesWhatsapp] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;

    if (editingEvent) {
      setPatient(editingEvent.patient ?? '');
      setService(editingEvent.service ?? 'Consulta médica');
      setValue(String(editingEvent.value ?? 200));
      setLocation(editingEvent.location ?? defaultLocation);
      setConvenio(editingEvent.convenio ?? '');
      setMedico('');
      setObservacoes(editingEvent.observacoes ?? '');
      setTelefone(editingEvent.telefone ? aplicarMascaraWhatsapp(editingEvent.telefone) : '');
      setLembretesWhatsapp(editingEvent.lembretesWhatsapp !== false);
      const s = editingEvent.start ? new Date(String(editingEvent.start)) : slotStart;
      const e = editingEvent.end ? new Date(String(editingEvent.end)) : slotEnd;
      setData(format(s, 'yyyy-MM-dd'));
      setHoraInicio(format(s, 'HH:mm'));
      setHoraFim(format(e, 'HH:mm'));
    } else {
      setPatientClienteId(initialClienteId || '');
      if (initialClienteId) {
        const c = clientes.find((x) => x.id === initialClienteId);
        if (c) {
          setPatient(c.nome);
          setTelefone(c.telefone ? aplicarMascaraWhatsapp(c.telefone) : '');
          setConvenio(c.convenio || '');
        } else {
          setPatient('');
        }
      } else {
        setPatient('');
      }
      setService('Consulta médica');
      setValue('200');
      setLocation(defaultLocation);
      setConvenio('');
      setMedico(medicos.length === 1 ? medicos[0] : '');
      setObservacoes('');
      setTelefone('');
      setLembretesWhatsapp(true);
      const inicio = format(slotStart, 'HH:mm');
      setData(format(slotStart, 'yyyy-MM-dd'));
      setHoraInicio(inicio);
      setHoraFim(horaMaisMinutos(inicio));
    }
    setFieldErrors({});
  }, [open, editingEvent, slotStart, slotEnd, defaultLocation, medicos, initialClienteId, clientes]);

  function onSelectCliente(id: string) {
    setPatientClienteId(id);
    const c = clientes.find((x) => x.id === id);
    if (c) {
      setPatient(c.nome);
      setTelefone(c.telefone ? aplicarMascaraWhatsapp(c.telefone) : '');
      if (c.convenio) setConvenio(c.convenio);
      setFieldErrors((f) => ({ ...f, patient: undefined }));
    } else {
      setPatient('');
    }
  }

  const clienteOptions = clientes.map((c) => ({
    value: c.id,
    label: c.nome,
    sublabel: [c.telefone, c.convenio].filter(Boolean).join(' · ') || undefined,
  }));

  const startComposto = useMemo(() => {
    if (!data || !horaInicio) return null;
    const d = new Date(`${data}T${horaInicio}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [data, horaInicio]);

  const tipoAuto = useMemo(() => {
    if (!startComposto || !patient.trim()) return 'nova_consulta' as const;
    const others = isEdit
      ? allEvents.filter((e) => String(e.id) !== String(editingEvent?.id))
      : allEvents;
    const tipo = classificarTipoConsulta(others, patient.trim(), startComposto);
    return tipo;
  }, [startComposto, patient, allEvents, isEdit, editingEvent?.id]);

  const tipoLabel =
    tipoAuto === 'retorno' ? ATENDIMENTO_LABEL.retorno : 'Nova consulta';

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  function validar(): FieldErrors {
    const errs: FieldErrors = {};
    if (!patient.trim() || patient.trim().length < 2) {
      errs.patient = 'Informe o nome do paciente';
    }
    if (!service.trim()) errs.service = 'Informe o serviço';
    if (!data) errs.data = 'Informe a data';
    if (!horaInicio) errs.horaInicio = 'Informe o horário de início';
    if (!horaFim) errs.horaFim = 'Informe o horário de fim';
    if (isClinica && medicos.length > 0 && !medico.trim()) {
      errs.medico = 'Selecione o profissional';
    }
    const ini = new Date(`${data}T${horaInicio}`);
    const fim = new Date(`${data}T${horaFim}`);
    if (!Number.isNaN(ini.getTime()) && !Number.isNaN(fim.getTime()) && fim <= ini) {
      errs.horaFim = 'O fim deve ser após o início';
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validar();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const start = new Date(`${data}T${horaInicio}`);
    const end = new Date(`${data}T${horaFim}`);

    await onConfirm({
      patient: patient.trim(),
      service: service.trim(),
      start,
      end,
      value: Number(value) || 0,
      location: location.trim(),
      convenio: convenio.trim(),
      medico: medico.trim() || (medicos.length === 1 ? medicos[0] : ''),
      observacoes: observacoes.trim(),
      telefone: telefone.trim(),
      lembretesWhatsapp,
      editingId: editingEvent?.id ? String(editingEvent.id) : null,
    });
  }

  const temErros = Object.keys(fieldErrors).length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-[#228B22]" />
              {isEdit ? 'Editar consulta' : 'Nova consulta'}
            </h2>
            <p className="text-sm text-gray-500">
              {data && horaInicio
                ? `${format(new Date(`${data}T${horaInicio}`), 'dd/MM/yyyy HH:mm')}`
                : 'Preencha os dados do atendimento'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
          {temErros && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>Preencha os campos obrigatórios marcados abaixo.</p>
            </div>
          )}

          <div>
            {useClienteSelect ? (
              <SearchableSelect
                label="Paciente *"
                options={clienteOptions}
                value={patientClienteId}
                onChange={onSelectCliente}
                placeholder="Buscar e selecionar cliente..."
                searchPlaceholder="Nome, telefone ou convênio..."
                error={fieldErrors.patient}
              />
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do paciente *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    autoFocus
                    value={patient}
                    onChange={(e) => {
                      setPatient(e.target.value);
                      if (fieldErrors.patient) setFieldErrors((f) => ({ ...f, patient: undefined }));
                    }}
                    placeholder="Ex: Maria Silva"
                    className={`w-full rounded-xl border pl-10 pr-4 py-3 text-sm ${
                      fieldErrors.patient ? 'border-red-400 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                </div>
                {fieldErrors.patient && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.patient}</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp do paciente
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(aplicarMascaraWhatsapp(e.target.value))}
                placeholder="(99) 99999-9999"
                className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-sm"
              />
            </div>
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lembretesWhatsapp}
                onChange={(e) => setLembretesWhatsapp(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-[#228B22] focus:ring-[#228B22]"
              />
              <span className="text-xs text-gray-600 leading-snug">
                Incluir esta consulta nos lembretes do Dashboard (7 e 1 dia antes) — você envia pelo
                seu WhatsApp com mensagem personalizada.
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serviço *</label>
            <input
              type="text"
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                if (fieldErrors.service) setFieldErrors((f) => ({ ...f, service: undefined }));
              }}
              className={inputClass(!!fieldErrors.service)}
            />
            {fieldErrors.service && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.service}</p>
            )}
          </div>

          {isClinica && medicos.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Profissional *
              </label>
              <select
                value={medico}
                onChange={(e) => {
                  setMedico(e.target.value);
                  if (fieldErrors.medico) setFieldErrors((f) => ({ ...f, medico: undefined }));
                }}
                className={inputClass(!!fieldErrors.medico)}
              >
                <option value="">Selecione o médico</option>
                {medicos.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {fieldErrors.medico && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.medico}</p>
              )}
            </div>
          )}

          <ConvenioSelect
            value={convenio}
            onChange={setConvenio}
            label="Plano / convênio"
            allowEmpty
            emptyLabel="Particular ou não informado"
          />

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
            <p className="text-sm text-gray-700 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              Tipo (automático)
            </p>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                tipoAuto === 'retorno'
                  ? 'bg-teal-100 text-teal-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {tipoLabel}
            </span>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Retorno se o paciente foi atendido nos últimos {DIAS_RETORNO} dias.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
            <input
              type="date"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
                if (fieldErrors.data) setFieldErrors((f) => ({ ...f, data: undefined }));
              }}
              className={inputClass(!!fieldErrors.data)}
            />
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => {
                  const novo = e.target.value;
                  setHoraInicio(novo);
                  if (novo) setHoraFim(horaMaisMinutos(novo));
                  if (fieldErrors.horaInicio)
                    setFieldErrors((f) => ({ ...f, horaInicio: undefined, horaFim: undefined }));
                }}
                className={inputClass(!!fieldErrors.horaInicio)}
              />
              {fieldErrors.horaInicio && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.horaInicio}</p>
              )}
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fim *{' '}
                <span className="font-normal text-gray-400">
                  (padrão +{DURACAO_CONSULTA_MIN} min)
                </span>
              </label>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => {
                  setHoraFim(e.target.value);
                  if (fieldErrors.horaFim)
                    setFieldErrors((f) => ({ ...f, horaFim: undefined }));
                }}
                className={inputClass(!!fieldErrors.horaFim)}
              />
              {fieldErrors.horaFim && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.horaFim}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              placeholder="Opcional"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#013a01] text-white font-semibold hover:bg-[#025201] disabled:opacity-50"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Agendar consulta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
