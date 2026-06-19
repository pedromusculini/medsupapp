import type { ClinicalChartGroup } from './types';

/** Sugere aba inicial a partir da especialidade do médico (texto livre). */
export function suggestGroupFromSpecialty(specialty: string | null | undefined): ClinicalChartGroup {
  const s = (specialty ?? '').toLowerCase();
  if (/pediatr|neonat|endocrin.*infant/i.test(s)) return 'pediatria';
  if (/oncol|hematol|radio|mastolog/i.test(s)) return 'oncologia';
  if (/cardio|nefro|endocrin|clinica|geriatr|metabol|diabet|intern/i.test(s)) return 'cardiometabolico';
  if (/pneumo|torac|alerg/i.test(s)) return 'pneumo';
  if (/psiqu|psicol|dermat|reumat|ortop|neuro|dor/i.test(s)) return 'escalas';
  return 'cardiometabolico';
}
