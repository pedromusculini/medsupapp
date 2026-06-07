/** Helpers compartilhados (client + server) para conteúdo de prontuário. */

export const PRONTUARIO_CLINICA_PREFIX = '[Prontuário — clínica]\n';

export function isProntuarioObservacao(texto: string): boolean {
  return texto.trimStart().toLowerCase().startsWith('[prontuário');
}

export function stripProntuarioPrefix(texto: string): string {
  const trimmed = texto.trimStart();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('[prontuário')) {
    const nl = trimmed.indexOf('\n');
    return nl >= 0 ? trimmed.slice(nl + 1).trimStart() : trimmed.replace(/^\[[^\]]+\]\s*/, '');
  }
  return trimmed;
}
