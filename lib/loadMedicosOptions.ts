/** Carrega nomes para o select de médico (clínica: equipe + titular; solo: nome do perfil). */

export type ProfissionalOption = {
  id: string;
  nome: string;
  agenda_google_status: 'connected' | 'pending' | null;
  cor_agenda?: string | null;
};

export type MedicosOptionsResult = {
  medicos: string[];
  isClinica: boolean;
  profissionais: ProfissionalOption[];
};

function mergeMedicosList(
  titular: string,
  cadastrados: string[],
): string[] {
  const medicos: string[] = [];
  if (titular) {
    const dup = cadastrados.some((n) => n.toLowerCase() === titular.toLowerCase());
    if (!dup) medicos.push(titular);
  }
  for (const n of cadastrados) {
    if (!medicos.some((x) => x.toLowerCase() === n.toLowerCase())) {
      medicos.push(n);
    }
  }
  return medicos;
}

export async function loadMedicosOptions(): Promise<MedicosOptionsResult> {
  const res = await fetch('/api/perfil');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { medicos: [], isClinica: false, profissionais: [] };
  }

  const profile = data.profile ?? data;

  if (profile?.user_type === 'clinica') {
    const medRes = await fetch('/api/perfil/medicos');
    const medData = await medRes.json().catch(() => ({}));
    const rows = medRes.ok ? (medData.medicos ?? []) : [];
    const profissionais: ProfissionalOption[] = rows
      .map((m: {
        id: string;
        nome: string;
        agenda_google_status?: 'connected' | 'pending' | null;
      }) => ({
        id: m.id,
        nome: m.nome.trim(),
        agenda_google_status: m.agenda_google_status ?? null,
      }))
      .filter((m: ProfissionalOption) => m.nome);

    const cadastrados = profissionais.map((m) => m.nome);

    const titular =
      profile.full_name?.trim() || profile.clinic_name?.trim() || '';
    const medicos = mergeMedicosList(titular, cadastrados);

    return { medicos, isClinica: true, profissionais };
  }

  const solo = profile?.full_name?.trim();
  return {
    medicos: solo ? [solo] : [],
    isClinica: false,
    profissionais: [],
  };
}

export function profissionalIdByNome(
  profissionais: ProfissionalOption[],
  nome: string,
): string | undefined {
  const trimmed = nome.trim().toLowerCase();
  if (!trimmed) return undefined;
  return profissionais.find((p) => p.nome.toLowerCase() === trimmed)?.id;
}

export function profissionalHasAgendaConnected(
  profissionais: ProfissionalOption[],
  nome: string,
): boolean {
  const id = profissionalIdByNome(profissionais, nome);
  if (!id) return false;
  return profissionais.find((p) => p.id === id)?.agenda_google_status === 'connected';
}

/** Valor padrão quando há um único médico na lista */
export function defaultMedicoFromList(medicos: string[]): string {
  return medicos.length === 1 ? medicos[0] : '';
}

export function resolveMedicoValue(medicos: string[], medico: string): string {
  const trimmed = medico.trim();
  if (trimmed) return trimmed;
  return defaultMedicoFromList(medicos);
}

export function validateMedicoSelection(
  medicos: string[],
  medico: string,
  isClinica: boolean,
): string | undefined {
  if (isClinica && medicos.length === 0) {
    return 'Cadastre médicos em Meu Perfil antes de continuar.';
  }
  if (medicos.length > 0 && !resolveMedicoValue(medicos, medico)) {
    return 'Selecione o médico';
  }
  return undefined;
}
