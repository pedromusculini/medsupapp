'use client';

import { useCallback, useEffect, useState } from 'react';
import { Contact, Loader2, Search, X } from 'lucide-react';
import type { GoogleContactImport } from '@/lib/googleContacts';
import { GOOGLE_CONTACTS_MIN_QUERY_LEN } from '@/lib/googleContacts';

type GoogleContactsImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: (summary: string) => void;
  onNeedAuth: () => void;
};

type ListResponse = {
  contacts: GoogleContactImport[];
  nextPageToken: string | null;
  aviso?: string | null;
  hint?: string | null;
  error?: string;
  code?: string;
};

export default function GoogleContactsImportModal({
  open,
  onClose,
  onImported,
  onNeedAuth,
}: GoogleContactsImportModalProps) {
  const [busca, setBusca] = useState('');
  const [contacts, setContacts] = useState<GoogleContactImport[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(
    `Digite pelo menos ${GOOGLE_CONTACTS_MIN_QUERY_LEN} caracteres e pressione Enter para buscar.`,
  );
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (opts: { q: string; pageToken?: string; append?: boolean }) => {
      const params = new URLSearchParams();
      params.set('q', opts.q.trim());
      if (opts.pageToken) params.set('pageToken', opts.pageToken);

      const res = await fetch(`/api/clientes/google-contacts?${params.toString()}`);
      const data = (await res.json()) as ListResponse;
      if (data.code === 'CONTACTS_NOT_CONNECTED') {
        onNeedAuth();
        throw new Error('CONTACTS_NOT_CONNECTED');
      }
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar contatos');

      setAviso(data.aviso ?? null);
      setHint(data.hint ?? null);
      setNextPageToken(data.nextPageToken ?? null);
      setContacts((prev) =>
        opts.append ? [...prev, ...(data.contacts ?? [])] : data.contacts ?? [],
      );
    },
    [onNeedAuth],
  );

  useEffect(() => {
    if (!open) return;
    setBusca('');
    setContacts([]);
    setSelected(new Set());
    setNextPageToken(null);
    setError(null);
    setAviso(null);
    setHint(
      `Digite pelo menos ${GOOGLE_CONTACTS_MIN_QUERY_LEN} caracteres e pressione Enter para buscar.`,
    );
  }, [open]);

  async function executarBusca() {
    const q = busca.trim();
    if (q.length < GOOGLE_CONTACTS_MIN_QUERY_LEN) {
      setHint(`Digite pelo menos ${GOOGLE_CONTACTS_MIN_QUERY_LEN} caracteres para buscar.`);
      setContacts([]);
      setNextPageToken(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      await fetchPage({ q });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'CONTACTS_NOT_CONNECTED') return;
      setError(err instanceof Error ? err.message : 'Erro na busca');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void executarBusca();
    }
  }

  function toggle(resourceName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(resourceName)) next.delete(resourceName);
      else next.add(resourceName);
      return next;
    });
  }

  async function loadMore() {
    if (!nextPageToken || loadingMore) return;
    const q = busca.trim();
    if (q.length < GOOGLE_CONTACTS_MIN_QUERY_LEN) return;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage({ q, pageToken: nextPageToken, append: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar mais');
    } finally {
      setLoadingMore(false);
    }
  }

  async function importSelected() {
    if (selected.size === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/sync-google-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceNames: [...selected] }),
      });
      const data = await res.json();
      if (data.code === 'CONTACTS_NOT_CONNECTED') {
        onNeedAuth();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Erro ao importar');
      onImported(
        `${data.criados ?? 0} novo(s), ${data.ignorados ?? 0} já existente(s).`,
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao importar');
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Contact className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900">Contatos Google</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Nome, telefone ou e-mail — Enter para buscar"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm"
              autoFocus
            />
          </div>

          {hint && !error && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{hint}</p>
          )}
          {aviso && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{aviso}</p>
          )}
          {error && (
            <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Buscando...
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">
              {busca.trim().length > 0 && busca.trim().length < GOOGLE_CONTACTS_MIN_QUERY_LEN
                ? 'Digite mais caracteres e pressione Enter.'
                : 'Nenhum contato encontrado. Use a busca acima.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => {
                const checked = selected.has(c.googleResourceName);
                return (
                  <li key={c.googleResourceName}>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        checked
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.googleResourceName)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-gray-900 truncate">{c.nome}</span>
                        <span className="block text-xs text-gray-500 truncate">
                          {[c.telefone, c.email].filter(Boolean).join(' · ') || 'Sem telefone/e-mail'}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {nextPageToken && !loading && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="w-full py-2.5 text-sm font-medium text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-50 disabled:opacity-50"
            >
              {loadingMore ? 'Carregando...' : 'Carregar mais 20'}
            </button>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void importSelected()}
            disabled={importing || selected.size === 0}
            className="flex-1 py-3 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50"
          >
            {importing
              ? 'Importando...'
              : `Importar selecionados (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
