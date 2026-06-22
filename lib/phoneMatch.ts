/**
 * Compatibilidade — funções de telefone em `@/lib/phone`.
 */
export {
  brPhoneLocalDigits,
  formatarTelefoneBr,
  phoneDigits,
  phonesMatch,
} from '@/lib/phone';

/** Nome sem acentos/pontuação — para casar Drive com Google Contatos. */
export function normalizeNome(nome: string | null | undefined): string {
  if (!nome) return '';
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Compara nomes (exato ou contém palavras-chave suficientes). */
export function nomesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeNome(a);
  const nb = normalizeNome(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.startsWith(`${nb} `) || nb.startsWith(`${na} `)) return true;
  const wa = na.split(' ').filter((w) => w.length > 1);
  const wb = nb.split(' ').filter((w) => w.length > 1);
  if (wa.length < 2 || wb.length < 2) return false;
  const setB = new Set(wb);
  const overlap = wa.filter((w) => setB.has(w)).length;
  return overlap >= 2 && overlap >= Math.min(wa.length, wb.length) - 1;
}
