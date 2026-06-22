'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { MAX_PORTFOLIO_FOTOS } from '@/lib/portfolio';

type PortfolioFotoApi = {
  slot: number;
  url: string | null;
  legenda?: string | null;
};

type PortfolioApi = {
  id: string;
  medico_slug: string;
  historia: string | null;
  competencias: string | null;
  ativo: boolean;
  fotos: PortfolioFotoApi[];
  public_url: string | null;
};

type PortfolioEditorModalProps = {
  medicoId?: string | null;
  medicoNome: string;
  onClose: () => void;
  onSaved?: () => void;
};

function portfolioApiBase(medicoId?: string | null): string {
  return medicoId ? `/api/perfil/medicos/${medicoId}/portfolio` : '/api/perfil/portfolio';
}

export default function PortfolioEditorModal({
  medicoId,
  medicoNome,
  onClose,
  onSaved,
}: PortfolioEditorModalProps) {
  const apiBase = portfolioApiBase(medicoId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [historia, setHistoria] = useState('');
  const [competencias, setCompetencias] = useState('');
  const [ativo, setAtivo] = useState(false);
  const [fotos, setFotos] = useState<PortfolioFotoApi[]>([]);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [ownerSlug, setOwnerSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      const p = data.portfolio as PortfolioApi;
      setHistoria(p.historia || '');
      setCompetencias(p.competencias || '');
      setAtivo(!!p.ativo);
      setFotos(p.fotos || []);
      setPublicUrl(p.public_url);
      setOwnerSlug(data.owner_slug ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar portfólio');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(apiBase, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historia, competencias, ativo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      const p = data.portfolio as PortfolioApi;
      setPublicUrl(p.public_url);
      onSaved?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (slot: number, file: File) => {
    setUploadingSlot(slot);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('slot', String(slot));
      const res = await fetch(apiBase, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto');
      const p = data.portfolio as PortfolioApi;
      setFotos(p.fotos || []);
      setPublicUrl(p.public_url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar foto');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemoveFoto = async (slot: number) => {
    setUploadingSlot(slot);
    setError('');
    try {
      const res = await fetch(`${apiBase}?slot=${slot}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover foto');
      const p = data.portfolio as PortfolioApi;
      setFotos(p.fotos || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover foto');
    } finally {
      setUploadingSlot(null);
    }
  };

  const slots = Array.from({ length: MAX_PORTFOLIO_FOTOS }, (_, i) => i);
  const fotoBySlot = (slot: number) => fotos.find((f) => f.slot === slot);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Portfólio — {medicoNome}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Página pública opcional · fotos convertidas para WebP
            </p>
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

        <div className="p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {!ownerSlug && !loading && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Configure o link de agendamento em{' '}
              <strong>Configurações → Comunicação</strong> para gerar a URL pública{' '}
              <code className="text-xs">/pro/seu-slug/medico</code>.
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              <label className="block space-y-1.5 text-sm text-gray-700">
                História / apresentação
                <textarea
                  value={historia}
                  onChange={(e) => setHistoria(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 resize-y"
                  placeholder="Conte sua trajetória, formação, abordagem com pacientes..."
                />
              </label>

              <label className="block space-y-1.5 text-sm text-gray-700">
                Competências e diferenciais
                <textarea
                  value={competencias}
                  onChange={(e) => setCompetencias(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 resize-y"
                  placeholder="Procedimentos, áreas de atuação, certificações..."
                />
              </label>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Fotos do consultório (até {MAX_PORTFOLIO_FOTOS})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {slots.map((slot) => {
                    const foto = fotoBySlot(slot);
                    const busy = uploadingSlot === slot;
                    return (
                      <div
                        key={slot}
                        className="relative aspect-[4/3] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden"
                      >
                        {foto?.url ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={foto.url}
                              alt={`Foto ${slot + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => void handleRemoveFoto(slot)}
                              disabled={busy}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 disabled:opacity-50"
                              title="Remover foto"
                            >
                              {busy ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-full cursor-pointer hover:bg-gray-100 transition p-2">
                            {busy ? (
                              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                            ) : (
                              <>
                                <ImagePlus className="w-6 h-6 text-gray-400 mb-1" />
                                <span className="text-xs text-gray-500 text-center">Adicionar</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                              className="sr-only"
                              disabled={busy}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleUpload(slot, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-start gap-3 text-sm text-gray-700 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-emerald-600"
                />
                <span>
                  <strong>Publicar portfólio</strong> — visível em{' '}
                  <code className="text-xs bg-white px-1 rounded">/pro/…</code> e no
                  autoagendamento quando ativo.
                </span>
              </label>

              {publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver página pública
                </a>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar portfólio'}
          </button>
        </div>
      </div>
    </div>
  );
}
