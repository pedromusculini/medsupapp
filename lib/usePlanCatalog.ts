'use client';

import { useEffect, useState } from 'react';
import { PLAN_IDS, PLANOS } from '@/lib/constants';
import type { PlanId } from '@/lib/subscriptionPlans';
import type { PlanCatalogEntry } from '@/lib/planCatalog';

export type PlanCatalogItem = PlanCatalogEntry & { id: PlanId };

const FALLBACK: PlanCatalogItem[] = PLAN_IDS.map((id) => ({
  id,
  ...PLANOS[id],
}));

export function usePlanCatalog() {
  const [planos, setPlanos] = useState<PlanCatalogItem[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/planos/catalog')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.planos) && d.planos.length > 0) {
          setPlanos(d.planos);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { planos, loading };
}
