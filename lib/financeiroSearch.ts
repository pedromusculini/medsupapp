import { ATENDIMENTO_LABEL, CATEGORIA_LABEL } from "@/lib/constants";

export type FinanceiroSearchSplit = {
  medico?: string | null;
};

export type FinanceiroSearchTransacao = {
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  categoria?: string | null;
  medico?: string | null;
  observacao?: string | null;
  splits?: FinanceiroSearchSplit[] | null;
  valor_bruto?: number | null;
  valor_liquido?: number | null;
  valor_profissional?: number | null;
  valor_salao?: number | null;
  forma_pagamento?: string | null;
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeFinanceiroSearchText(value: string): string {
  return stripDiacritics(value).trim().toLowerCase();
}

function extractPacienteFromDescricao(
  descricao: string,
  tipo: "entrada" | "saida",
): string | null {
  if (tipo !== "entrada") return null;
  const trimmed = descricao.trim();
  if (!trimmed) return null;

  const dashParts = trimmed.split(" - ");
  if (dashParts.length >= 2) {
    const candidato = dashParts[1]?.trim();
    if (candidato) return candidato;
  }

  for (const sep of [" — ", " - "]) {
    const partes = trimmed.split(sep);
    if (partes.length >= 2) {
      const candidato = partes[1]?.trim();
      if (candidato) return candidato;
    }
  }

  return null;
}

function pushIfPresent(target: string[], value: string | null | undefined) {
  if (!value) return;
  const normalized = normalizeFinanceiroSearchText(String(value));
  if (normalized) target.push(normalized);
}

function normalizeMoneyTokens(value: number | null | undefined): string[] {
  if (value == null || !Number.isFinite(Number(value))) return [];
  const num = Number(value);
  const fixed = num.toFixed(2);
  const br = fixed.replace(".", ",");
  const digits = fixed.replace(/\D/g, "");
  const compact = fixed.replace(".", "");
  return [...new Set([fixed, br, digits, compact])].map(normalizeFinanceiroSearchText);
}

function queryMatchesValue(query: string, values: number[]): boolean {
  const normalizedQuery = normalizeFinanceiroSearchText(query);
  if (!normalizedQuery) return true;

  const queryDigits = normalizedQuery.replace(/\D/g, "");
  return values.some((value) => {
    const tokens = normalizeMoneyTokens(value);
    if (tokens.some((token) => token.includes(normalizedQuery))) return true;
    if (!queryDigits) return false;
    return tokens.some((token) => token.replace(/\D/g, "").includes(queryDigits));
  });
}

export function transacaoMatchesFinanceiroSearch(
  transacao: FinanceiroSearchTransacao,
  query: string,
): boolean {
  const normalizedQuery = normalizeFinanceiroSearchText(query);
  if (!normalizedQuery) return true;

  const haystacks: string[] = [];
  pushIfPresent(haystacks, transacao.descricao);
  pushIfPresent(haystacks, transacao.observacao);
  pushIfPresent(haystacks, transacao.medico);
  pushIfPresent(haystacks, transacao.categoria);
  pushIfPresent(
    haystacks,
    transacao.categoria
      ? CATEGORIA_LABEL[transacao.categoria] ?? transacao.categoria
      : null,
  );
  pushIfPresent(haystacks, transacao.forma_pagamento);
  pushIfPresent(
    haystacks,
    transacao.forma_pagamento
      ? ATENDIMENTO_LABEL[transacao.forma_pagamento] ?? transacao.forma_pagamento
      : null,
  );
  pushIfPresent(haystacks, transacao.tipo);
  pushIfPresent(haystacks, transacao.tipo === "saida" ? "Saida" : "Entrada");
  pushIfPresent(haystacks, extractPacienteFromDescricao(transacao.descricao, transacao.tipo));

  for (const split of transacao.splits ?? []) {
    pushIfPresent(haystacks, split.medico);
  }

  if (haystacks.some((value) => value.includes(normalizedQuery))) return true;

  return queryMatchesValue(normalizedQuery, [
    transacao.valor,
    transacao.valor_bruto ?? null,
    transacao.valor_liquido ?? null,
    transacao.valor_profissional ?? null,
    transacao.valor_salao ?? null,
  ].filter((value): value is number => value != null));
}
