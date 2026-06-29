'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Bell,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  X,
} from 'lucide-react';
import {
  DEFAULT_LEMBRETES_SETTINGS,
  type LembretesWhatsappSettings,
} from '@/lib/lembretesConfig';
import { lembreteAntecedenciaLabel } from '@/lib/mensagemTemplate';
import { isMobileDevice, openWhatsAppUrl } from '@/lib/openExternalUrl';
import { startConsultasRevisionWatch } from '@/lib/consultasRevisionPoll';
import { formatAgendaFetchError } from '@/lib/fetchWithTimeout';

type LembreteItem = {
  id: string;
  paciente: string;
  data: string;
  hora: string;
  medico: string | null;
  mensagem: string;
  whatsapp_url: string | null;
  whatsapp_app_url?: string | null;
  whatsapp_android_url?: string | null;
};

type LembretesPendentesResponse = {
  lembretes7?: LembreteItem[];
  lembretes1?: LembreteItem[];
  lembretesSettings?: LembretesWhatsappSettings;
  error?: string;
};

const LEMBRETES_PULL_INTERVAL_MS = 30_000;

function lembretesListsEqual(
  a7: LembreteItem[],
  a1: LembreteItem[],
  b7: LembreteItem[],
  b1: LembreteItem[],
): boolean {
  const token = (items: LembreteItem[]) =>
    items
      .map((i) => `${i.id}\x1f${i.data}\x1f${i.hora}\x1f${i.medico ?? ''}`)
      .join('\x1e');
  return token(a7) === token(b7) && token(a1) === token(b1);
}

export default function LembretesWhatsAppCard() {
  const [lembretes7, setLembretes7] = useState<LembreteItem[]>([]);
  const [lembretes1, setLembretes1] = useState<LembreteItem[]>([]);
  const [lembretesSettings, setLembretesSettings] = useState<LembretesWhatsappSettings>(
    DEFAULT_LEMBRETES_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [dispensando, setDispensando] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const listsRef = useRef({ lembretes7, lembretes1 });
  listsRef.current = { lembretes7, lembretes1 };

  const applyResponse = useCallback((d: LembretesPendentesResponse) => {
    const next7 = d.lembretes7 ?? [];
    const next1 = d.lembretes1 ?? [];
    const prev = listsRef.current;
    if (!lembretesListsEqual(prev.lembretes7, prev.lembretes1, next7, next1)) {
      setLembretes7(next7);
      setLembretes1(next1);
    }
    if (d.lembretesSettings) setLembretesSettings(d.lembretesSettings);
    setLastUpdatedAt(new Date());
    setLoadError(null);
  }, []);

  const load = useCallback(
    async (options?: { syncGoogle?: boolean; silent?: boolean }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const silent = options?.silent === true;
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const params = new URLSearchParams();
      if (options?.syncGoogle) params.set('syncGoogle', '1');
      params.set('_', String(Date.now()));

      try {
        const res = await fetch(`/api/lembretes/pendentes?${params}`, {
          cache: 'no-store',
        });
        const d = (await res.json()) as LembretesPendentesResponse;
        if (!res.ok) {
          throw new Error(d.error?.trim() || `Falha ao carregar lembretes (${res.status})`);
        }
        applyResponse(d);
      } catch (err) {
        setLoadError(formatAgendaFetchError(err));
      } finally {
        inFlightRef.current = false;
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [applyResponse],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void load({ silent: true });
      }
    };

    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);

    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [load]);

  useEffect(() => {
    const mobile = isMobileDevice();
    const stopRevision = startConsultasRevisionWatch({
      intervalMs: mobile ? 15_000 : 25_000,
      onRevisionChange: () => void load({ silent: true }),
      onError: (err) => setLoadError(formatAgendaFetchError(err)),
    });

    const pullId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load({ silent: true });
    }, LEMBRETES_PULL_INTERVAL_MS);

    return () => {
      stopRevision();
      window.clearInterval(pullId);
    };
  }, [load]);

  async function marcarEnviado(id: string, tipo: 'd7' | 'd1') {
    const url = `/api/lembretes/${id}/marcar-enviado`;
    const body = JSON.stringify({ tipo });
    if (typeof navigator !== 'undefined' && isMobileDevice() && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      void load({ silent: true });
      return;
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
    void load({ silent: true });
  }

  async function dispensar(id: string, tipo: 'd7' | 'd1') {
    const key = `${tipo}-${id}`;
    setDispensando(key);
    try {
      const res = await fetch(`/api/lembretes/${id}/dispensar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      if (res.ok) void load({ silent: true });
    } finally {
      setDispensando(null);
    }
  }

  function copiar(id: string, texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }

  function Lista({
    titulo,
    items,
    tipo,
  }: {
    titulo: string;
    items: LembreteItem[];
    tipo: 'd7' | 'd1';
  }) {
    if (items.length === 0) return null;
    return (
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{titulo}</h3>
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={`${tipo}-${item.id}`}
              className="p-4 rounded-xl border border-gray-100 bg-[#f8f9fa] flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.paciente}</p>
                <p className="text-sm text-gray-500">
                  {item.data} às {item.hora}
                  {item.medico ? ` · ${item.medico}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {item.whatsapp_url && (
                  <button
                    type="button"
                    onClick={() => {
                      openWhatsAppUrl(item.whatsapp_url!, {
                        appUrl: item.whatsapp_app_url ?? undefined,
                        androidUrl: item.whatsapp_android_url ?? undefined,
                      });
                      void marcarEnviado(item.id, tipo);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copiar(item.id, item.mensagem)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-white"
                >
                  {copiado === item.id ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Copiar
                </button>
                <button
                  type="button"
                  disabled={dispensando === `${tipo}-${item.id}`}
                  onClick={() => void dispensar(item.id, tipo)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:bg-white hover:text-gray-700 disabled:opacity-50"
                  title="Remover este aviso do Dashboard sem enviar WhatsApp"
                >
                  {dispensando === `${tipo}-${item.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Remover aviso
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6"
      data-tour="lembretes-whatsapp"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-50">
            <Bell className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Lembretes WhatsApp</h2>
            <p className="text-sm text-gray-500">
              Envie pelo seu WhatsApp Business — mensagens personalizadas em{' '}
              <Link href="/dashboard/configuracoes" className="text-emerald-600 font-medium">
                Configurações
              </Link>
            </p>
            {lastUpdatedAt && !loadError && (
              <p className="text-xs text-gray-400 mt-1">
                Última atualização: {format(lastUpdatedAt, 'dd/MM HH:mm')}
                {refreshing ? ' · atualizando…' : ''}
              </p>
            )}
            {loadError && (
              <p className="text-xs text-red-600 mt-1">Falha ao atualizar: {loadError}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load({ syncGoogle: true })}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium self-start sm:self-center disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : lembretes7.length === 0 && lembretes1.length === 0 ? (
        <p className="text-sm text-gray-500 mt-4 py-6 text-center">
          Nenhum lembrete pendente para hoje.
          {lembretesSettings.lembrete_antecedencia_ativo ||
          lembretesSettings.lembrete_1_dia_ativo ? (
            <>
              {' '}
              Consultas aparecem aqui quando faltam{' '}
              {lembretesSettings.lembrete_antecedencia_ativo
                ? `${lembretesSettings.lembrete_antecedencia_dias} dia(s)`
                : ''}
              {lembretesSettings.lembrete_antecedencia_ativo &&
              lembretesSettings.lembrete_1_dia_ativo
                ? ' e '
                : ''}
              {lembretesSettings.lembrete_1_dia_ativo ? '1 dia' : ''} para a consulta, com
              lembrete WhatsApp ativo em Configurações.
            </>
          ) : (
            <> Ative os lembretes em Configurações → Mensagens.</>
          )}
        </p>
      ) : (
        <>
          {lembretesSettings.lembrete_antecedencia_ativo && (
            <Lista
              titulo={lembreteAntecedenciaLabel(lembretesSettings.lembrete_antecedencia_dias)}
              items={lembretes7}
              tipo="d7"
            />
          )}
          {lembretesSettings.lembrete_1_dia_ativo && (
            <Lista titulo="1 dia antes" items={lembretes1} tipo="d1" />
          )}
        </>
      )}

      <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        Ao abrir o WhatsApp, confirme o envio no seu celular.
      </p>
    </section>
  );
}
