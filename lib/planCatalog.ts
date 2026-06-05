import { PLAN_IDS, PLANOS, type PlanIdKey } from '@/lib/constants';

export type PlanId = (typeof PLAN_IDS)[number];
import { supabaseAdmin } from '@/lib/supabaseClient';

export type PlanCatalogEntry = {
  nome: string;
  valor: number;
  periodo: string;
  medicos: string;
  descricao: string;
  destaque: boolean;
};

function defaults(): Record<PlanId, PlanCatalogEntry> {
  return {
    'medico-pix': { ...PLANOS['medico-pix'] },
    'clinica-5-pix': { ...PLANOS['clinica-5-pix'] },
    'clinica-10-pix': { ...PLANOS['clinica-10-pix'] },
  };
}

let memCache: Record<PlanId, PlanCatalogEntry> | null = null;
let memCacheAt = 0;
const CACHE_TTL_MS = 30_000;

export function invalidatePlanCatalogCache(): void {
  memCache = null;
  memCacheAt = 0;
}

export async function loadPlanCatalog(): Promise<Record<PlanId, PlanCatalogEntry>> {
  const now = Date.now();
  if (memCache && now - memCacheAt < CACHE_TTL_MS) return memCache;

  const merged = defaults();
  try {
    const { data, error } = await supabaseAdmin
      .from('plan_catalog')
      .select('plan_id, nome, valor, periodo, medicos, descricao, destaque')
      .in('plan_id', PLAN_IDS);

    if (!error && data?.length) {
      for (const row of data) {
        const id = row.plan_id as PlanId;
        if (!(id in merged)) continue;
        merged[id] = {
          nome: row.nome ?? merged[id].nome,
          valor: Number(row.valor),
          periodo: row.periodo ?? merged[id].periodo,
          medicos: row.medicos ?? merged[id].medicos,
          descricao: row.descricao ?? merged[id].descricao,
          destaque: Boolean(row.destaque),
        };
      }
    }
  } catch (err) {
    console.error('[planCatalog/load]', err);
  }

  memCache = merged;
  memCacheAt = now;
  return merged;
}

export function getPlanCatalogSync(): Record<PlanId, PlanCatalogEntry> {
  return memCache ?? defaults();
}

export function getPlanValor(plano: string): number {
  const catalog = getPlanCatalogSync();
  if (plano in catalog) return catalog[plano as PlanIdKey].valor;
  return catalog['medico-pix'].valor;
}

export async function getPlanValorLoaded(plano: string): Promise<number> {
  await loadPlanCatalog();
  return getPlanValor(plano);
}

export async function updatePlanCatalogValor(
  planId: PlanId,
  valor: number,
  updatedBy: string,
): Promise<PlanCatalogEntry> {
  if (!Number.isFinite(valor) || valor <= 0 || valor > 50_000) {
    throw new Error('Valor inválido (use entre 0,01 e 50.000).');
  }

  const current = await loadPlanCatalog();
  const row = current[planId];

  const { error } = await supabaseAdmin.from('plan_catalog').upsert(
    {
      plan_id: planId,
      nome: row.nome,
      valor,
      periodo: row.periodo,
      medicos: row.medicos,
      descricao: row.descricao,
      destaque: row.destaque,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy.toLowerCase().trim(),
    },
    { onConflict: 'plan_id' },
  );

  if (error) throw error;
  invalidatePlanCatalogCache();
  const next = await loadPlanCatalog();
  return next[planId];
}

export async function listPlanCatalogRows(): Promise<
  Array<PlanCatalogEntry & { plan_id: PlanId; updated_at: string | null; updated_by: string | null }>
> {
  const catalog = await loadPlanCatalog();
  const { data } = await supabaseAdmin
    .from('plan_catalog')
    .select('plan_id, updated_at, updated_by')
    .in('plan_id', PLAN_IDS);

  const meta = new Map((data ?? []).map((r) => [r.plan_id, r]));

  return PLAN_IDS.map((id) => ({
    plan_id: id,
    ...catalog[id],
    updated_at: meta.get(id)?.updated_at ?? null,
    updated_by: meta.get(id)?.updated_by ?? null,
  }));
}
