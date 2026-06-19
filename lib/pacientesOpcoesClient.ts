/**
 * Cache client-side compartilhado para /api/clientes/pacientes-opcoes.
 * Evita refetch em cada mount de PacienteSearchField na mesma sessão.
 */

import type { PacienteOpcao } from '@/lib/types';

export type PacientesOpcoesPayload = {
  opcoes: PacienteOpcao[];
  total?: number;
  google_contatos_disponivel: boolean;
  google_busca_ativa?: boolean;
  drive_conectado: boolean;
  aviso: string | null;
  hint_busca_google?: string | null;
};

/** TTL do cache no browser (minutos). */
export const PACIENTES_OPCOES_CLIENT_TTL_MS = 5 * 60 * 1000;

type CacheKey = string;

let inflight = new Map<CacheKey, Promise<PacientesOpcoesPayload>>();
let cached = new Map<CacheKey, { data: PacientesOpcoesPayload; at: number }>();

function opcoesCacheKey(options?: {
  q?: string;
  limit?: number;
  google?: boolean;
}): CacheKey {
  const q = options?.q?.trim() ?? '';
  const lim = options?.limit ?? '';
  const g = options?.google ? '1' : '0';
  return `${lim}:${g}:${q}`;
}

export function invalidatePacientesOpcoesClientCache(): void {
  inflight.clear();
  cached.clear();
}

export async function fetchPacientesOpcoes(options?: {
  force?: boolean;
  q?: string;
  limit?: number;
  google?: boolean;
}): Promise<PacientesOpcoesPayload> {
  const key = opcoesCacheKey(options);
  const now = Date.now();

  if (
    !options?.force &&
    cached.has(key) &&
    now - (cached.get(key)?.at ?? 0) < PACIENTES_OPCOES_CLIENT_TTL_MS
  ) {
    return cached.get(key)!.data;
  }

  if (!options?.force && inflight.has(key)) {
    return inflight.get(key)!;
  }

  const params = new URLSearchParams();
  if (options?.q?.trim()) params.set('q', options.q.trim());
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.google) params.set('google', '1');

  const promise = fetch(`/api/clientes/pacientes-opcoes?${params.toString()}`)
    .then(async (res) => {
      const data = (await res.json()) as PacientesOpcoesPayload & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível carregar a lista de pacientes.');
      }
      const payload: PacientesOpcoesPayload = {
        opcoes: data.opcoes ?? [],
        total: typeof data.total === 'number' ? data.total : undefined,
        google_contatos_disponivel: !!data.google_contatos_disponivel,
        google_busca_ativa: data.google_busca_ativa === true,
        drive_conectado: data.drive_conectado !== false,
        aviso: data.aviso ?? null,
        hint_busca_google: data.hint_busca_google ?? null,
      };
      cached.set(key, { data: payload, at: Date.now() });
      return payload;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
