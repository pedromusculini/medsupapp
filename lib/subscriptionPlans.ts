import { PLAN_IDS, PLANOS } from '@/lib/constants';
import { loadPlanCatalog } from '@/lib/planCatalog';

export type PlanId = keyof typeof PLANOS;

export { PLAN_IDS };

const PLAN_ORDER: Record<PlanId, number> = {
  'medico-pix': 1,
  'clinica-5-pix': 2,
  'clinica-10-pix': 3,
};

export function isValidPlanId(value: string): value is PlanId {
  return PLAN_IDS.includes(value as PlanId);
}

export type PlanNormalizeContext = {
  user_type?: string | null;
  doctors_count?: number | null;
};

/**
 * Converte IDs legados/administrativos (ex.: `ilimitado`) para o catálogo vigente.
 * Usado em perfis criados antes da padronização `*-pix`.
 */
export function normalizePlanId(
  raw: string | null | undefined,
  context?: PlanNormalizeContext,
): PlanId {
  const trimmed = (raw ?? '').trim();
  if (isValidPlanId(trimmed)) return trimmed;

  const key = trimmed.toLowerCase();
  const userType = context?.user_type ?? null;
  const doctorsCount = context?.doctors_count ?? null;

  if (key === 'ilimitado') {
    if (userType === 'medico') return 'medico-pix';
    if (typeof doctorsCount === 'number' && doctorsCount > 5) return 'clinica-10-pix';
    return 'clinica-10-pix';
  }

  const staticMap: Record<string, PlanId> = {
    medico: 'medico-pix',
    'medico-solo': 'medico-pix',
    clinica: 'clinica-5-pix',
    'clinica-5': 'clinica-5-pix',
    'clinica-10': 'clinica-10-pix',
  };
  if (staticMap[key]) return staticMap[key];

  if (userType === 'clinica') {
    if (typeof doctorsCount === 'number' && doctorsCount > 5) return 'clinica-10-pix';
    return 'clinica-5-pix';
  }

  return 'medico-pix';
}

export function resolveProfilePlanId(
  profile: {
    plan?: string | null;
    user_type?: string | null;
    doctors_count?: number | null;
  },
): PlanId {
  return normalizePlanId(profile.plan, profile);
}

export function planToUserType(plan: PlanId): 'medico' | 'clinica' {
  return plan === 'medico-pix' ? 'medico' : 'clinica';
}

/** Máximo de cadastros em `clinica_medicos` (além do titular da conta). */
export function maxMedicosCadastrados(plan: PlanId): number {
  if (plan === 'medico-pix') return 0;
  if (plan === 'clinica-5-pix') return 5;
  return 10;
}

/** Limite operacional da clínica (espelha o plano; não é escolhido manualmente). */
export function doctorsCountFromPlan(plan: string): number | null {
  if (plan === 'clinica-5-pix') return 5;
  if (plan === 'clinica-10-pix') return 10;
  return null;
}

export function isDowngrade(currentPlan: PlanId, newPlan: PlanId): boolean {
  return PLAN_ORDER[newPlan] < PLAN_ORDER[currentPlan];
}

/** Avisos comuns quando o downgrade remove médicos da equipe na plataforma. */
export function appendDowngradeMedicoSafetyWarnings(warnings: string[]): void {
  warnings.push(
    'Os médicos que excederem o limite do novo plano serão removidos do cadastro da clínica nesta plataforma (não aparecerão mais na equipe).',
  );
  warnings.push(
    'Pacientes, consultas, financeiro e demais arquivos da conta permanecem salvos no Google Drive pessoal vinculado ao login Google que você usa aqui — a plataforma não apaga esse conteúdo no Drive.',
  );
  warnings.push(
    'Antes de confirmar o downgrade, recomendamos abrir Backup no menu do app e baixar/exportar os dados se quiser uma cópia local adicional.',
  );
}

export type ClinicaMedicoRow = {
  id: string;
  nome: string;
  created_at: string;
};

export type PlanChangeImpact = {
  isSamePlan: boolean;
  isDowngrade: boolean;
  requiresDataLossAck: boolean;
  warnings: string[];
  principalMantido: string | null;
  medicosRemovidos: { count: number; nomes: string[] };
};

export function getPlanChangeImpact(
  currentPlan: PlanId,
  newPlan: PlanId,
  medicos: ClinicaMedicoRow[],
  profile: {
    user_type: string;
    full_name?: string | null;
  },
): PlanChangeImpact {
  const isSamePlan = currentPlan === newPlan;
  const downgrade = isDowngrade(currentPlan, newPlan);
  const warnings: string[] = [];
  let medicosRemovidos: { count: number; nomes: string[] } = { count: 0, nomes: [] };
  let principalMantido: string | null = null;

  const sorted = [...medicos].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (newPlan === 'medico-pix' && profile.user_type === 'clinica') {
    principalMantido =
      profile.full_name?.trim() ||
      sorted[0]?.nome ||
      'Titular da conta (dados profissionais do perfil principal)';
    medicosRemovidos = {
      count: sorted.length,
      nomes: sorted.map((m) => m.nome),
    };
    warnings.push(
      'Ao mudar de Clínica para Médico Solo, a gestão de equipe deixa de existir: todos os médicos cadastrados na clínica serão removidos do cadastro na plataforma.',
    );
    warnings.push(
      `Permanecerá apenas o cadastro principal (${principalMantido}) no seu perfil de Médico Solo. Dados do titular no perfil são preservados; os demais médicos da equipe serão desvinculados.`,
    );
    if (sorted.length > 0) {
      warnings.push(
        `Médicos que serão removidos da equipe: ${sorted.map((m) => m.nome).join(', ')}.`,
      );
    }
    warnings.push(
      'Pacientes, agenda e financeiro da conta continuam vinculados ao titular; não há exclusão de dados de pacientes nesta operação.',
    );
  } else if (
    currentPlan === 'clinica-10-pix' &&
    newPlan === 'clinica-5-pix' &&
    sorted.length > 5
  ) {
    const excess = sorted.slice(5);
    medicosRemovidos = {
      count: excess.length,
      nomes: excess.map((m) => m.nome),
    };
    principalMantido = null;
    warnings.push(
      'Ao reduzir do plano Clínica 6 a 10 para Clínica 2 a 5, o limite de médicos cadastrados passa de 10 para 5.',
    );
    warnings.push(
      `Os médicos cadastrados a partir do 6º (${excess.map((m) => m.nome).join(', ')}) serão removidos permanentemente.`,
    );
    warnings.push(
      `Permanecerão os 5 primeiros cadastros (ordem de inclusão): ${sorted
        .slice(0, 5)
        .map((m) => m.nome)
        .join(', ')}.`,
    );
  } else if (
    profile.user_type === 'medico' &&
    newPlan !== 'medico-pix' &&
    !isSamePlan
  ) {
    warnings.push(
      'Ao mudar para plano Clínica, sua conta passará ao modo clínica: equipe de médicos, financeiro da clínica e horários por profissional.',
    );
    warnings.push(
      'Após confirmar, preencha nome da clínica e CNPJ em Meu Perfil, se ainda não estiverem cadastrados.',
    );
    warnings.push(
      'Pacientes, agenda e arquivos no Google Drive permanecem na sua conta Google.',
    );
  } else if (downgrade && !isSamePlan) {
    warnings.push(
      'Você está reduzindo o plano. Revise os limites do novo plano antes de confirmar.',
    );
  }

  const requiresDataLossAck =
    medicosRemovidos.count > 0 ||
    (newPlan === 'medico-pix' && profile.user_type === 'clinica');

  if (requiresDataLossAck) {
    appendDowngradeMedicoSafetyWarnings(warnings);
  }

  return {
    isSamePlan,
    isDowngrade: downgrade,
    requiresDataLossAck,
    warnings,
    principalMantido,
    medicosRemovidos,
  };
}

export async function getPlanCatalog() {
  const catalog = await loadPlanCatalog();
  return PLAN_IDS.map((id) => ({
    id,
    ...catalog[id],
    user_type: planToUserType(id),
    max_medicos: maxMedicosCadastrados(id),
  }));
}
