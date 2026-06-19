'use client';

import { useEffect, useState } from 'react';

/** `null` = carregando; `true` = titular; `false` = equipe (sem financeiro). */
export function useClinicaTitular(): boolean | null {
  const [titular, setTitular] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/clinica-titular')
      .then((r) => (r.ok ? r.json() : { titular: true }))
      .then((data) => {
        if (!cancelled) setTitular(data.titular === true);
      })
      .catch(() => {
        if (!cancelled) setTitular(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return titular;
}
