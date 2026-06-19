'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Link2,
  Copy,
  MessageCircle,
  RefreshCw,
  Loader2,
  UserPlus,
  Sparkles,
} from 'lucide-react';

type AutocadastroState = {
  link: string | null;
  mensagem_whatsapp?: string;
  pendentes: number;
};

type AutocadastroLinkCardProps = {
  /** `settings` = aba Configurações (card claro); `dashboard` = destaque (legado). */
  variant?: 'dashboard' | 'settings';
};

export default function AutocadastroLinkCard({ variant = 'dashboard' }: AutocadastroLinkCardProps) {
  const [data, setData] = useState<AutocadastroState>({ link: null, pendentes: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState<'link' | 'msg' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/formulario/autocadastro');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar');
      setData({
        link: json.link ?? null,
        mensagem_whatsapp: json.mensagem_whatsapp,
        pendentes: json.pendentes ?? 0,
      });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function gerarLink() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/formulario/autocadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar link');
      setData({
        link: json.link,
        mensagem_whatsapp: json.mensagem_whatsapp,
        pendentes: 0,
      });
      if (json.link) await navigator.clipboard.writeText(json.link);
      setCopied('link');
      setTimeout(() => setCopied(null), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setGenerating(false);
    }
  }

  async function sincronizar() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/sync-formularios', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === 'DRIVE_NOT_CONNECTED') {
          throw new Error(
            'Conecte o Google Drive em Backup ou autorize o Drive na Agenda.',
          );
        }
        throw new Error(json.error || 'Erro ao sincronizar');
      }
      await load();
      if (json.sincronizados > 0) {
        alert(
          `${json.sincronizados} paciente(s) importado(s) com sucesso. Veja em Clientes.`,
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSyncing(false);
    }
  }

  async function copiar(texto: string, tipo: 'link' | 'msg') {
    await navigator.clipboard.writeText(texto);
    setCopied(tipo);
    setTimeout(() => setCopied(null), 2000);
  }

  const whatsappUrl = data.mensagem_whatsapp
    ? `https://wa.me/?text=${encodeURIComponent(data.mensagem_whatsapp)}`
    : null;

  const embedded = variant === 'settings';

  return (
    <div
      className={
        embedded
          ? 'bg-white rounded-2xl border border-gray-100 p-5 shadow-sm'
          : 'bg-gradient-to-br from-emerald-800 to-emerald-900 rounded-2xl p-6 text-white shadow-lg mb-8'
      }
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className={`w-6 h-6 ${embedded ? 'text-emerald-600' : ''}`} />
            <h2
              className={`text-xl font-bold ${embedded ? 'text-gray-900' : ''}`}
            >
              Link de cadastro do paciente
            </h2>
          </div>
          <p
            className={
              embedded
                ? 'text-gray-600 text-sm max-w-xl leading-relaxed'
                : 'text-emerald-100 text-sm max-w-xl leading-relaxed'
            }
          >
            O paciente preenche nome, telefone e dados sozinho. Depois, importe para a lista de
            Clientes (Google Drive).
          </p>
          {!embedded && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-white/15 rounded-full px-3 py-1">
              <Sparkles className="w-3.5 h-3.5" />
              Para marcar consulta, use o link de agendamento abaixo
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={gerarLink}
            disabled={generating || loading}
            className={
              embedded
                ? 'inline-flex items-center gap-2 bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-800 disabled:opacity-60'
                : 'inline-flex items-center gap-2 bg-white text-emerald-800 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-50 disabled:opacity-60'
            }
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            {data.link ? 'Criar outro link' : 'Criar link de cadastro'}
          </button>
          {data.pendentes > 0 && (
            <button
              type="button"
              onClick={sincronizar}
              disabled={syncing}
              className={
                embedded
                  ? 'inline-flex items-center gap-2 border border-emerald-600 text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-50 disabled:opacity-60'
                  : 'inline-flex items-center gap-2 border border-white/40 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 disabled:opacity-60'
              }
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Importar cadastros ({data.pendentes})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div
          className={`mt-6 flex items-center gap-2 text-sm ${embedded ? 'text-gray-500' : 'text-emerald-100'}`}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando...
        </div>
      ) : data.link ? (
        <div
          className={
            embedded
              ? 'mt-4 bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100'
              : 'mt-6 bg-white/10 rounded-xl p-4 space-y-3'
          }
        >
          <p
            className={
              embedded
                ? 'text-xs text-gray-500 font-medium uppercase tracking-wide'
                : 'text-xs text-emerald-200 font-medium uppercase tracking-wide'
            }
          >
            Link para enviar ao paciente
          </p>
          <p
            className={`text-sm break-all font-mono rounded-lg p-3 ${
              embedded ? 'bg-white border border-gray-200' : 'bg-black/20'
            }`}
          >
            {data.link}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copiar(data.link!, 'link')}
              className={
                embedded
                  ? 'inline-flex items-center gap-1.5 text-sm border border-gray-200 bg-white hover:bg-gray-50 px-3 py-2 rounded-lg'
                  : 'inline-flex items-center gap-1.5 text-sm bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg'
              }
            >
              <Copy className="w-4 h-4" />
              {copied === 'link' ? 'Copiado!' : 'Copiar link'}
            </button>
            {data.mensagem_whatsapp && (
              <button
                type="button"
                onClick={() => copiar(data.mensagem_whatsapp!, 'msg')}
                className={
                  embedded
                    ? 'inline-flex items-center gap-1.5 text-sm border border-gray-200 bg-white hover:bg-gray-50 px-3 py-2 rounded-lg'
                    : 'inline-flex items-center gap-1.5 text-sm bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg'
                }
              >
                <Copy className="w-4 h-4" />
                {copied === 'msg' ? 'Copiado!' : 'Copiar mensagem'}
              </button>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm bg-[#25D366] hover:bg-[#20bd5a] px-3 py-2 rounded-lg font-medium"
              >
                <MessageCircle className="w-4 h-4" />
                Compartilhar no WhatsApp
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className={`mt-4 text-sm ${embedded ? 'text-gray-500' : 'text-emerald-200'}`}>
          Você ainda não tem um link. Toque em &quot;Criar link de cadastro&quot; para começar.
        </p>
      )}

      {error && (
        <p className="mt-4 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <p
        className={`mt-4 text-xs leading-relaxed ${
          embedded ? 'text-gray-500' : 'text-emerald-200/80'
        }`}
      >
        Após importar, os pacientes aparecem em{' '}
        <Link
          href="/clientes"
          className={embedded ? 'text-emerald-600 font-medium underline' : 'underline font-medium text-white'}
        >
          Clientes
        </Link>
        . Requer Google Drive conectado.
      </p>
    </div>
  );
}
