'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Save, Shield } from 'lucide-react';
import InternalAdminNav from '@/components/InternalAdminNav';
import { ADMIN_API_PREFIX, formatCurrency } from '@/lib/constants';
import type { PlanId } from '@/lib/subscriptionPlans';

type PlanRow = {
  plan_id: PlanId;
  nome: string;
  valor: number;
  medicos: string;
  descricao: string;
  destaque: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

export default function InternalPlanosClient() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${ADMIN_API_PREFIX}/plans`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar');
      const rows = data.plans as PlanRow[];
      setPlans(rows);
      setDrafts(Object.fromEntries(rows.map((p) => [p.plan_id, String(p.valor)])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(planId: PlanId) {
    const raw = drafts[planId] ?? '';
    const valor = Number(raw.replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      setError('Informe um valor mensal válido.');
      return;
    }

    setSavingId(planId);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${ADMIN_API_PREFIX}/plans`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, valor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setMessage(data.message || 'Salvo.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 bg-gradient-to-r from-red-950 via-zinc-950 to-zinc-950 border-b border-red-900/70">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600/15 border border-red-500/40">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-zinc-50">Planos e preços</h1>
              <p className="text-xs text-zinc-500">Catálogo para novos clientes · contrato 12 meses por assinante</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-200 px-3 py-2 rounded-lg border border-zinc-700"
            >
              ← App principal
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-700/80 text-red-200 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Atualizar
            </button>
          </div>
        </div>
        <InternalAdminNav />
      </header>

      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 space-y-6">
        <div className="rounded-2xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90 leading-relaxed">
          Alterações aqui afetam <strong>novos cadastros</strong> e renovações após o fim do contrato de
          12 meses. Quem já assinou mantém o valor travado em{' '}
          <code className="text-amber-200">assinaturas.locked_monthly_value</code> até a data de
          vencimento do bloqueio.
        </div>

        {message && (
          <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-4 py-3">
            {message}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {loading && plans.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-red-400" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.plan_id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 flex flex-col gap-4"
              >
                <div>
                  <p className="text-xs font-mono text-zinc-500">{plan.plan_id}</p>
                  <h2 className="text-lg font-bold text-zinc-50">{plan.nome}</h2>
                  <p className="text-sm text-zinc-400">{plan.medicos}</p>
                </div>
                <p className="text-xs text-zinc-500 flex-1">{plan.descricao}</p>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Valor mensal (R$)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={drafts[plan.plan_id] ?? ''}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [plan.plan_id]: e.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Atual: {formatCurrency(plan.valor)}
                  </p>
                </div>
                {plan.updated_at && (
                  <p className="text-[10px] text-zinc-600">
                    Última alteração: {new Date(plan.updated_at).toLocaleString('pt-BR')} por{' '}
                    {plan.updated_by ?? '—'}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void save(plan.plan_id)}
                  disabled={savingId === plan.plan_id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold py-2.5 text-sm disabled:opacity-50"
                >
                  {savingId === plan.plan_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar preço
                </button>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
