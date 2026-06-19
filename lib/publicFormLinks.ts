/** URLs públicas do formulário de cadastro (/f). */

export function getPublicAppBaseUrl(): string {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

export function buildFormularioPublicPath(token: string): string {
  return `/f/${token}`;
}

/** Ficha do paciente para médico (anamnese + evoluções), com login Google. */
export function buildClienteFichaProfissionalPath(token: string): string {
  return `/f/${token}?view=profissional`;
}

export function buildFormularioPublicUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? getPublicAppBaseUrl();
  return `${base}${buildFormularioPublicPath(token)}`;
}

export function buildClienteFichaProfissionalUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? getPublicAppBaseUrl();
  return `${base}${buildClienteFichaProfissionalPath(token)}`;
}
