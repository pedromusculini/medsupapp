'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, User } from 'lucide-react';
import { format } from 'date-fns';
import FinalizarAtendimentoModal, {
  type FinalizarAtendimentoPayload,
} from '@/components/FinalizarAtendimentoModal';
import { useMedicosOptions } from '@/lib/useMedicosOptions';
import {
  type ConsultationRecord,
  type FormaPagamentoConsulta,
  loadConsultations,
  saveConsultations,
  getConsultasHoje,
  STATUS_CONSULTA_UI,
  TIPO_CONSULTA_UI,
  formatHorario,
  FORMAS_PAGAMENTO_CONSULTA,
  applyFinalizarConsulta,
  consultationsListsEqual,
} from '@/lib/consultations';
import { refreshConsultasFromServer } from '@/lib/syncConsultasClient';
import { invalidateFinanceiroCache } from '@/lib/financeiroCache';
import {
  MSG_FINALIZAR_CLIENTE_FALHOU,
  MSG_FINANCEIRO_FALHOU,
  postFinalizarClienteFromAgenda,
  postFinanceiroEntradaFromAgenda,
} from '@/lib/finalizarClienteFromAgenda';
import { useClinicaTitular } from '@/lib/useClinicaTitular';
import { formatCurrency } from '@/lib/constants';

const DASHBOARD_SYNC_DEFER_MS = 1500;
const REFRESH_DEBOUNCE_MS = 500;

function parseConsultaDateTime(consulta: ConsultationRecord): {
  data: string;
  hora: string;
} {
  const raw = consulta.start;
  const d =
    typeof raw === 'string' ? new Date(raw) : raw instanceof Date ? raw : new Date();
  return { data: format(d, 'yyyy-MM-dd'), hora: format(d, 'HH:mm') };
}

type DashboardAgendaHojeProps = {
  userEmail?: string;
};

export default function DashboardAgendaHoje({ userEmail = '' }: DashboardAgendaHojeProps) {
  const { medicos, isClinica } = useMedicosOptions();
  const clinicaTitular = useClinicaTitular();
  const [events, setEvents] = useState<ConsultationRecord[]>([]);
  const [finalizando, setFinalizando] = useState<ConsultationRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [finalizarErro, setFinalizarErro] = useState<string | null>(null);
  const syncRemoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRemoteRef = useRef(false);

  const applyLocal = useCallback(() => {
    const local = loadConsultations(userEmail);
    setEvents((prev) => (consultationsListsEqual(prev, local) ? prev : local));
    return local;
  }, []);

  const syncRemote = useCallback(async () => {
    if (syncingRemoteRef.current) return;
    syncingRemoteRef.current = true;
    const local = loadConsultations(userEmail);

    try {
      const merged = await refreshConsultasFromServer(local);
      setEvents((prev) => (consultationsListsEqual(prev, merged) ? prev : merged));

      if (!consultationsListsEqual(local, merged)) {
        saveConsultations(merged, { broadcast: false, ownerEmail: userEmail });
      }
    } catch {
      /* best-effort */
    } finally {
      syncingRemoteRef.current = false;
    }
  }, []);

  const scheduleSyncRemote = useCallback(() => {
    if (syncRemoteTimerRef.current) clearTimeout(syncRemoteTimerRef.current);
    syncRemoteTimerRef.current = setTimeout(() => {
      syncRemoteTimerRef.current = null;
      void syncRemote();
    }, REFRESH_DEBOUNCE_MS);
  }, [syncRemote]);

  useEffect(() => {
    applyLocal();
    const deferTimer = setTimeout(() => void syncRemote(), DASHBOARD_SYNC_DEFER_MS);

    const onConsultationsUpdated = () => {
      applyLocal();
      scheduleSyncRemote();
    };

    const onStorage = () => {
      applyLocal();
    };

    window.addEventListener('medsupapp-consultations-updated', onConsultationsUpdated);
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimeout(deferTimer);
      if (syncRemoteTimerRef.current) clearTimeout(syncRemoteTimerRef.current);
      window.removeEventListener('medsupapp-consultations-updated', onConsultationsUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [applyLocal, syncRemote, scheduleSyncRemote]);

  const hoje = getConsultasHoje(events);

  async function handleFinalizarAtendimento(payload: FinalizarAtendimentoPayload) {
    if (!finalizando?.id) return;
    setSaving(true);
    setFinalizarErro(null);

    const consultaId = finalizando.id;
    const paciente = finalizando.patient ?? payload.nome;
    const clienteId = payload.clienteId ?? finalizando.clienteDriveId ?? null;

    const apiBody = {
      data: payload.data,
      hora: payload.hora || null,
      valor: payload.valorOriginal,
      valorOriginal: payload.valorOriginal,
      descontoPercent: payload.descontoPercent,
      descontoValor: payload.descontoValor,
      forma_pagamento: payload.formaPagamento,
      plano: payload.plano || null,
      medico: payload.medico || null,
      percentual_profissional: payload.percentualProfissional,
      parcelas: payload.parcelas,
      tipo: payload.tipo,
      observacoes: payload.prontuario || null,
      nome: payload.nome,
      telefone: payload.telefone,
      lembretes_whatsapp: payload.lembretesWhatsapp,
      cliente_id: clienteId,
      paciente_sel: payload.pacienteSel,
    };

    try {
      let resOk = false;
      if (clienteId) {
        const clienteRes = await postFinalizarClienteFromAgenda(clienteId, {
          data: payload.data,
          hora: payload.hora || null,
          valor: payload.valorOriginal,
          valorOriginal: payload.valorOriginal,
          descontoPercent: payload.descontoPercent,
          descontoValor: payload.descontoValor,
          forma_pagamento: payload.formaPagamento as FormaPagamentoConsulta,
          medico: payload.medico || '',
          parcelas: payload.parcelas,
          tipo: payload.tipo,
          plano: payload.plano || null,
          observacoes: payload.prontuario || null,
        });
        if (!clienteRes.ok) {
          setFinalizarErro(clienteRes.error || MSG_FINALIZAR_CLIENTE_FALHOU);
          return;
        }
        resOk = true;
      } else {
        const res = await fetch('/api/clientes/atendimento-avulso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiBody),
        });
        const data = await res.json();
        if (!res.ok) {
          setFinalizarErro(data.error || 'Erro ao registrar atendimento');
          return;
        }
        resOk = res.ok;
      }

      if (!resOk) {
        setFinalizarErro('Erro ao registrar atendimento');
        return;
      }

      const tipoConsulta: 'nova_consulta' | 'retorno' =
        payload.tipo === 'retorno' ? 'retorno' : 'nova_consulta';

      const updated = applyFinalizarConsulta(events, consultaId, {
        valorPago: payload.valorPago,
        valorOriginal: payload.valorOriginal,
        formaPagamento: payload.formaPagamento as FormaPagamentoConsulta,
        convenio: payload.plano,
        descontoPercent: payload.descontoPercent,
        descontoValor: payload.descontoValor,
        parcelas: payload.parcelas,
        tipoConsulta,
        medico: payload.medico,
        percentualProfissional: payload.percentualProfissional,
      });

      saveConsultations(updated);
      setEvents(updated);
      setFinalizando(null);

      const formaLabel =
        FORMAS_PAGAMENTO_CONSULTA.find((f) => f.id === payload.formaPagamento)?.label ??
        payload.formaPagamento;
      const tipoLabel = TIPO_CONSULTA_UI[tipoConsulta]?.label ?? 'Novo atendimento';

      if (clinicaTitular !== false) {
        try {
          const pagamentoObs = `Pagamento: ${formaLabel}${payload.parcelas > 1 ? ` (${payload.parcelas}x)` : ''}`;
          const financeiroRes = await postFinanceiroEntradaFromAgenda({
            descricao: [tipoLabel, paciente, formaLabel, payload.plano || null]
              .filter(Boolean)
              .join(' - '),
            data: payload.data,
            valor: payload.valorPago,
            medico: payload.medico,
            forma_pagamento: payload.formaPagamento,
            parcelas: payload.parcelas,
            percentual_profissional: payload.percentualProfissional,
            observacao: pagamentoObs,
          });
          if (financeiroRes.ok) {
            if (userEmail) invalidateFinanceiroCache(userEmail);
          } else {
            window.alert(`${MSG_FINANCEIRO_FALHOU}\n\n${financeiroRes.error}`);
          }
        } catch {
          window.alert(MSG_FINANCEIRO_FALHOU);
        }
      }

      applyLocal();
    } catch (err: unknown) {
      setFinalizarErro(err instanceof Error ? err.message : 'Erro ao finalizar');
    } finally {
      setSaving(false);
    }
  }

  const consultaDt = finalizando ? parseConsultaDateTime(finalizando) : null;

  return (
    <>
      <div
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        data-tour="atendimentos-hoje"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Atendimentos de hoje</h2>
          <Link
            href="/agenda"
            className="text-sm text-emerald-600 hover:underline flex items-center gap-1"
          >
            Ver agenda <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {hoje.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Nenhuma consulta agendada para hoje.</p>
            <Link
              href="/agenda"
              className="inline-block mt-3 text-sm text-emerald-600 font-medium hover:underline"
            >
              Agendar consulta
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {hoje.map((item) => {
              const st =
                STATUS_CONSULTA_UI[item.status ?? 'confirmado'] ??
                STATUS_CONSULTA_UI.confirmado;
              const tipo =
                item.tipoConsulta && TIPO_CONSULTA_UI[item.tipoConsulta];
              const podeFinalizar =
                item.status !== 'realizado' &&
                item.status !== 'cancelado' &&
                item.status !== 'faltou';

              return (
                <div
                  key={String(item.id)}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-emerald-100 hover:bg-emerald-50/50 transition"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-800 w-14 shrink-0 tabular-nums">
                      {formatHorario(item)}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {item.patient || 'Sem nome'}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {tipo && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipo.color}`}
                          >
                            {tipo.label}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {item.service || 'Consulta'}
                        </span>
                        {item.medico && (
                          <span className="text-xs text-gray-500">· {item.medico}</span>
                        )}
                      </div>
                      {item.status === 'realizado' && item.payment && (
                        <p className="text-xs text-emerald-700 mt-1 font-medium">
                          {formatCurrency(item.payment.valorPago)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0 pl-[4.25rem] sm:pl-0">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.color}`}
                    >
                      {st.label}
                    </span>
                    {podeFinalizar && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setFinalizarErro(null);
                          setFinalizando(item);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-700 text-white px-3 py-2 rounded-lg hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Finalizar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {finalizando && consultaDt && (
        <FinalizarAtendimentoModal
          onClose={() => {
            setFinalizando(null);
            setFinalizarErro(null);
          }}
          onConfirm={handleFinalizarAtendimento}
          clienteId={finalizando.clienteDriveId ?? null}
          nomeInicial={finalizando.patient ?? ''}
          medicoInicial={finalizando.medico ?? ''}
          valorInicial={finalizando.value ?? 200}
          dataInicial={consultaDt.data}
          horaInicial={consultaDt.hora}
          pacienteFixo={Boolean(finalizando.patient)}
          isClinica={isClinica}
          medicos={medicos}
          saving={saving}
          erroEnvio={finalizarErro}
        />
      )}
    </>
  );
}
