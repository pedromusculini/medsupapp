/**
 * Portal legado `/prontuario/[token]` — desativado por padrão em produção.
 * Defina `PRONTUARIO_TOKEN_ENABLED=true` apenas para testes locais ou migração temporária.
 */
export function isProntuarioTokenEnabled(): boolean {
  const raw = process.env.PRONTUARIO_TOKEN_ENABLED?.trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return process.env.NODE_ENV !== 'production';
}

export const PRONTUARIO_TOKEN_DISABLED_MESSAGE =
  'O portal de prontuário por link foi descontinuado. Médicos acessam a ficha do paciente pelo Google Calendar (login Google + agenda conectada).';
