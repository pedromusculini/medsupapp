'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, CalendarPlus, RotateCcw, AlertCircle, Phone, MessageCircle, Loader2 } from 'lucide-react';
import { MENSAGEM_TIPO_INFO } from '@/lib/mensagemTemplate';
import type { MensagemTipo } from '@/lib/mensagensWhatsapp';
import { isMobileDevice, openWhatsAppUrl, preOpenExternalTab } from '@/lib/openExternalUrl';
import PhoneInput, { phoneValueForInput } from '@/components/PhoneInput';
import { formatPhoneDisplay, isValidPhone, PHONE_VALIDATION_MESSAGE } from '@/lib/phone';
import { format } from 'date-fns';
import ConvenioSelect from '@/components/ConvenioSelect';
import MedicoSelect from '@/components/MedicoSelect';
import {
  defaultMedicoFromList,
  resolveMedicoValue,
  validateMedicoSelection,
} from '@/lib/loadMedicosOptions';
import PacienteSearchField from '@/components/PacienteSearchField';
import type { PacienteOpcao } from '@/lib/types';
import {
  fetchTelefoneClienteDrive,
  findTelefoneGooglePorNome,
  selFromDriveId,
  telefoneFromOpcao,
  telefonePreenchido,
} from '@/lib/pacienteOpcoesUi';
import { fetchPacientesOpcoes } from '@/lib/pacientesOpcoesClient';
import { ensurePacienteCliente } from '@/lib/ensurePacienteClienteClient';
import { Trash2 } from 'lucide-react';
import {
  classificarTipoConsulta,
  DIAS_RETORNO,
  DURACAO_CONSULTA_MIN,
  horaMaisMinutos,
  TIPO_CONSULTA_UI,
  type ConsultationRecord,
  type TipoConsulta,
} from '@/lib/consultations';

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
  clienteDriveId?: string | null;
  pacienteSel?: string;
  editingId?: string | null;
  tipoConsulta?: 'nova_consulta' | 'retorno';
};

type FieldErrors = Partial<
  Record<'patient' | 'data' | 'horaInicio' | 'horaFim' | 'medico' | 'service' | 'telefone', string>
>;

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
  clientesIniciais?: PacienteOpcao[];
  initialClienteId?: string | null;
  onClose: () => void;
  onConfirm: (payload: AgendaConsultaPayload) => string | void | Promise<string | void>;
  onDelete?: () => void | Promise<void>;
  deleting?: boolean;
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
  clientesIniciais = [],
  initialClienteId = null,
  onClose,
  onConfirm,
  onDelete,
  deleting = false,
}: AgendaConsultaModalProps) {
  const isEdit = !!editingEvent?.id;

  const [pacienteSel, setPacienteSel] = useState('');
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
  const [tipoManual, setTipoManual] = useState<'auto' | TipoConsulta>('auto');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitErro, setSubmitErro] = useState<string | null>(null);
  const [whatsappPickerOpen, setWhatsappPickerOpen] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappPreview, setWhatsappPreview] = useState<string | null>(null);
  const [whatsappErro, setWhatsappErro] = useState<string | null>(null);
  const [savedConsultaId, setSavedConsultaId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const modalInitKeyRef = useRef<string | null>(null);
  /** Evita re-vincular ao paciente original depois que o usuário escolhe outro. */
  const userAlterouPacienteRef = useRef(false);

  const TEMPLATE_OPCOES: { tipo: MensagemTipo; label: string }[] = [
    {
      tipo: 'confirmacao_apos_agendar',
      label: MENSAGEM_TIPO_INFO.confirmacao_apos_agendar.titulo,
    },
    {
      tipo: 'lembrete_1_dia',
      label: MENSAGEM_TIPO_INFO.lembrete_1_dia.titulo,
    },
  ];

  const whatsappPronto =
    patient.trim().length >= 2 &&
    !!data &&
    !!horaInicio &&
    isValidPhone(telefone);

  const onPacientePicked = useCallback((sel: string, opt: PacienteOpcao | null) => {
    userAlterouPacienteRef.current = true;
    setPacienteSel(sel);
    if (opt) {
      setPatient(opt.nome);
      const tel = telefoneFromOpcao(opt);
      if (tel) {
        setTelefone(tel);
      } else if (sel.startsWith('d:')) {
        void fetchTelefoneClienteDrive(sel).then((fetched) => {
          if (fetched) setTelefone(fetched);
        });
      }
      if (opt.convenio) setConvenio(opt.convenio);
      setFieldErrors((f) => ({ ...f, patient: undefined, telefone: undefined }));
    } else {
      setPatient('');
    }
  }, []);

  useEffect(() => {
    if (!open) {
      modalInitKeyRef.current = null;
      return;
    }

    const editingId = editingEvent?.id ? String(editingEvent.id) : null;
    const initKey = editingId ?? `new:${slotStart.getTime()}`;
    if (modalInitKeyRef.current === initKey) return;
    modalInitKeyRef.current = initKey;
    userAlterouPacienteRef.current = false;

    if (editingEvent) {
      setPacienteSel(selFromDriveId(editingEvent.clienteDriveId));
      setPatient(editingEvent.patient ?? '');
      setService(editingEvent.service ?? 'Consulta médica');
      setValue(String(editingEvent.value ?? 200));
      setLocation(editingEvent.location ?? defaultLocation);
      setConvenio(editingEvent.convenio ?? '');
      setMedico(editingEvent.medico ?? '');
      setObservacoes(editingEvent.observacoes ?? '');
      let tel = editingEvent.telefone ? phoneValueForInput(editingEvent.telefone) : '';
      if (!tel && editingEvent.clienteDriveId && clientesIniciais.length > 0) {
        const sel = selFromDriveId(editingEvent.clienteDriveId);
        const c = clientesIniciais.find((x) => x.id === sel);
        if (c) tel = telefoneFromOpcao(c);
      }
      setTelefone(tel);
      setLembretesWhatsapp(editingEvent.lembretesWhatsapp !== false);
      const s = editingEvent.start ? new Date(String(editingEvent.start)) : slotStart;
      const e = editingEvent.end ? new Date(String(editingEvent.end)) : slotEnd;
      setData(format(s, 'yyyy-MM-dd'));
      setHoraInicio(format(s, 'HH:mm'));
      setHoraFim(format(e, 'HH:mm'));
      setTipoManual(editingEvent.tipoConsulta ?? 'auto');
    } else {
      const preSel = selFromDriveId(initialClienteId);
      setPacienteSel(preSel);
      setPatient('');
      setTelefone('');
      if (preSel && clientesIniciais.length > 0) {
        const c = clientesIniciais.find((x) => x.id === preSel);
        if (c) {
          setPatient(c.nome);
          const telOpt = telefoneFromOpcao(c);
          if (telOpt) setTelefone(telOpt);
          if (c.convenio) setConvenio(c.convenio);
        }
      }
      setService('Consulta médica');
      setValue('200');
      setLocation(defaultLocation);
      if (!preSel) setConvenio('');
      setMedico(defaultMedicoFromList(medicos));
      setObservacoes('');
      setLembretesWhatsapp(true);
      const inicio = format(slotStart, 'HH:mm');
      setData(format(slotStart, 'yyyy-MM-dd'));
      setHoraInicio(inicio);
      setHoraFim(horaMaisMinutos(inicio));
      setTipoManual('auto');
    }
    setFieldErrors({});
    setWhatsappPickerOpen(false);
    setWhatsappPreview(null);
    setWhatsappErro(null);
    setSavedConsultaId(editingEvent?.id ? String(editingEvent.id) : null);
    setJustSaved(false);
  }, [open, editingEvent, slotStart, slotEnd, defaultLocation, medicos, initialClienteId, clientesIniciais]);

  useEffect(() => {
    if (!open) return;

    const selVinculo =
      pacienteSel ||
      (editingEvent?.clienteDriveId ? selFromDriveId(editingEvent.clienteDriveId) : '');

    if (!telefonePreenchido(telefone) && patient.trim()) {
      void fetchPacientesOpcoes().then((payload) => {
        const telGoogle = findTelefoneGooglePorNome(patient, payload.opcoes);
        if (telGoogle) {
          setTelefone((prev) => (telefonePreenchido(prev) ? prev : telGoogle));
        }
      });
    }

    if (!selVinculo || telefonePreenchido(telefone)) return;

    const c = clientesIniciais.find((x) => x.id === selVinculo);
    const telLista = telefoneFromOpcao(c);
    if (telLista) {
      setTelefone(telLista);
      return;
    }

    if (selVinculo.startsWith('d:')) {
      void fetchTelefoneClienteDrive(selVinculo).then((fetched) => {
        if (fetched) setTelefone((prev) => (telefonePreenchido(prev) ? prev : fetched));
      });
    }
  }, [open, editingEvent, clientesIniciais, pacienteSel, telefone, patient]);

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

  const tipoFinal: TipoConsulta = tipoManual === 'auto' ? tipoAuto : tipoManual;
  const tipoUi = TIPO_CONSULTA_UI[tipoFinal];
  const tipoLabel = tipoUi.label;

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
    const nomeTrim = patient.trim();
    if (!pacienteSel && nomeTrim.length < 2) {
      errs.patient = 'Selecione um paciente na lista ou informe o nome';
    }
    if (!isEdit && !isValidPhone(telefone)) {
      errs.telefone = PHONE_VALIDATION_MESSAGE;
    }
    if (!service.trim()) errs.service = 'Informe o serviço';
    if (!data) errs.data = 'Informe a data';
    if (!horaInicio) errs.horaInicio = 'Informe o horário de início';
    if (!horaFim) errs.horaFim = 'Informe o horário de fim';
    const medicoErr = validateMedicoSelection(medicos, medico, isClinica);
    if (medicoErr) errs.medico = medicoErr;
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
    setSubmitErro(null);

    const start = new Date(`${data}T${horaInicio}`);
    const end = new Date(`${data}T${horaFim}`);
    let driveId = pacienteSel.startsWith('d:') ? pacienteSel.slice(2) : null;
    let patientName = patient.trim();

    try {
      const resolved = await ensurePacienteCliente({
        nome: patientName,
        telefone: telefone.trim(),
        cliente_id: driveId ?? editingEvent?.clienteDriveId ?? null,
        paciente_sel: pacienteSel,
      });
      driveId = resolved.id;
      patientName = resolved.nome;
      if (resolved.convenio && !convenio.trim()) setConvenio(resolved.convenio);
    } catch (err) {
      setSubmitErro(err instanceof Error ? err.message : 'Erro ao cadastrar paciente');
      return;
    }

    const savedId = await onConfirm({
      patient: patientName,
      service: service.trim(),
      start,
      end,
      value: Number(value) || 0,
      location: location.trim(),
      convenio: convenio.trim(),
      medico: resolveMedicoValue(medicos, medico),
      observacoes: observacoes.trim(),
      telefone: telefone.trim(),
      lembretesWhatsapp,
      clienteDriveId: driveId,
      pacienteSel,
      editingId: editingEvent?.id ? String(editingEvent.id) : null,
      tipoConsulta: tipoFinal,
    });

    if (savedId) {
      setSavedConsultaId(String(savedId));
      setJustSaved(true);
      setWhatsappPickerOpen(true);
    }
  }

  const temErros = Object.keys(fieldErrors).length > 0 || !!submitErro;

  async function enviarMensagemWhatsapp(tipo: MensagemTipo) {
    if (!whatsappPronto) return;
    const preOpened = isMobileDevice() ? null : preOpenExternalTab();
    setWhatsappLoading(true);
    setWhatsappErro(null);
    try {
      const res = await fetch('/api/consultas/mensagem-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          nome: patient.trim(),
          data,
          hora: horaInicio,
          telefone: telefone.trim(),
          medico: resolveMedicoValue(medicos, medico),
          local: location.trim(),
          consultaId:
            savedConsultaId ||
            (editingEvent?.id ? String(editingEvent.id) : null),
        }),
      });
      const dataRes = await res.json();
      if (!res.ok) {
        throw new Error(dataRes.error || 'Erro ao montar mensagem');
      }
      setWhatsappPreview(dataRes.mensagem ?? null);
      openWhatsAppUrl(dataRes.whatsapp_url as string, {
        appUrl: dataRes.whatsapp_app_url as string | undefined,
        androidUrl: dataRes.whatsapp_android_url as string | undefined,
        preOpened,
      });
    } catch (err) {
      preOpened?.close();
      setWhatsappErro(err instanceof Error ? err.message : 'Erro ao abrir WhatsApp');
    } finally {
      setWhatsappLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92dvh] sm:max-h-[92vh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-emerald-600" />
              {isEdit ? 'Editar consulta' : 'Nova consulta'}
            </h2>
            <p className="text-sm text-gray-500">
              {data && horaInicio
                ? `${format(new Date(`${data}T${horaInicio}`), 'dd/MM/yyyy HH:mm')}`
                : 'Agende retorno ou próximo atendimento'}
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
              <p>{submitErro || 'Preencha os campos obrigatórios marcados abaixo.'}</p>
            </div>
          )}

          {!isEdit ? (
            <PacienteSearchField
              value={pacienteSel}
              onChange={onPacientePicked}
              clientesIniciais={clientesIniciais}
              preselectDriveId={initialClienteId}
              error={fieldErrors.patient}
              manualName={patient}
              onManualNameChange={(n) => {
                setPatient(n);
                if (fieldErrors.patient) setFieldErrors((f) => ({ ...f, patient: undefined }));
              }}
              manualNameError={!pacienteSel ? fieldErrors.patient : undefined}
            />
          ) : (
            <div className="space-y-2">
              {!editingEvent?.clienteDriveId && !pacienteSel.startsWith('d:') && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Esta consulta ainda não está vinculada ao cadastro. Selecione o paciente abaixo
                  ou confirme o nome — ao salvar, criamos ou encontramos a ficha no Drive.
                </p>
              )}
              <PacienteSearchField
                value={pacienteSel}
                onChange={onPacientePicked}
                clientesIniciais={clientesIniciais}
                preselectDriveId={editingEvent?.clienteDriveId}
                label="Vincular ao cadastro"
                error={fieldErrors.patient}
                manualName={patient}
                onManualNameChange={(n) => {
                  setPatient(n);
                  if (fieldErrors.patient) setFieldErrors((f) => ({ ...f, patient: undefined }));
                }}
                manualNameError={!pacienteSel ? fieldErrors.patient : undefined}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp do paciente {!isEdit ? '*' : ''}
            </label>
            <PhoneInput
              value={telefone}
              onChange={(v) => {
                setTelefone(v);
                if (fieldErrors.telefone) setFieldErrors((f) => ({ ...f, telefone: undefined }));
              }}
              inputClassName={fieldErrors.telefone ? 'border-red-400 bg-red-50' : ''}
            />
            {fieldErrors.telefone && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.telefone}</p>
            )}
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lembretesWhatsapp}
                onChange={(e) => setLembretesWhatsapp(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-600 leading-snug">
                Incluir esta consulta nos lembretes do Dashboard (7 e 1 dia antes) — você envia pelo
                seu WhatsApp com mensagem personalizada.
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Mensagem WhatsApp</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Envie confirmação ou lembrete agora, sem esperar o Dashboard.
              </p>
            </div>
            {justSaved && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Consulta salva! Você pode enviar a confirmação pelo WhatsApp abaixo.
              </p>
            )}
            {!whatsappPronto ? (
              <p className="text-xs text-gray-500">
                Preencha nome do paciente, data, horário e WhatsApp para habilitar o envio.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={whatsappLoading}
                  onClick={() => setWhatsappPickerOpen((v) => !v)}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {whatsappLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                  Enviar consulta no WhatsApp
                </button>
                {whatsappPickerOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TEMPLATE_OPCOES.map(({ tipo, label }) => (
                      <button
                        key={tipo}
                        type="button"
                        disabled={whatsappLoading}
                        onClick={() => void enviarMensagemWhatsapp(tipo)}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-left text-sm font-medium text-gray-800 hover:border-[#25D366] hover:bg-green-50 disabled:opacity-50"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {whatsappPreview && (
                  <p className="text-xs text-gray-600 whitespace-pre-wrap rounded-lg border border-gray-100 bg-white p-3 max-h-32 overflow-y-auto">
                    {whatsappPreview}
                  </p>
                )}
              </>
            )}
            {whatsappErro && <p className="text-xs text-red-600">{whatsappErro}</p>}
            <p className="text-[11px] text-gray-400">
              Abre o WhatsApp no navegador — confirme o envio no celular. Modelos em{' '}
              <span className="text-emerald-600">Comunicação → Configurações</span>.
            </p>
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

          <MedicoSelect
            medicos={medicos}
            isClinica={isClinica}
            value={medico}
            onChange={(v) => {
              setMedico(v);
              if (fieldErrors.medico) setFieldErrors((f) => ({ ...f, medico: undefined }));
            }}
            error={fieldErrors.medico}
            className={inputClass(!!fieldErrors.medico)}
            label="Médico"
          />

          <ConvenioSelect
            value={convenio}
            onChange={setConvenio}
            label="Plano / convênio"
            allowEmpty
            emptyLabel="Particular ou não informado"
          />

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                Tipo de atendimento
              </p>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tipoUi.color}`}>
                {tipoLabel}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Automático: retorno se o paciente foi atendido nos últimos {DIAS_RETORNO} dias.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'auto' as const, label: `Automático (${TIPO_CONSULTA_UI[tipoAuto].label})` },
                  { id: 'nova_consulta' as const, label: 'Novo atendimento' },
                  { id: 'retorno' as const, label: 'Retorno' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTipoManual(opt.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    tipoManual === opt.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-600'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

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

          <div className="flex flex-col gap-3 pt-2">
            {isEdit && onDelete && (
              <button
                type="button"
                disabled={saving || deleting}
                onClick={() => void onDelete()}
                className="w-full py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold flex items-center justify-center gap-2 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5" />
                {deleting ? 'Excluindo...' : 'Excluir agendamento'}
              </button>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="flex-1 py-3 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : justSaved ? 'Salvar e fechar' : 'Agendar consulta'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
