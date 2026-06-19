import type { Session } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

const INVALID_GOOGLE_SUB = new Set(['', 'unknown']);

export type EquipeMembership = {
  isEquipe: boolean;
  clinicaEmail?: string;
  nomeProfissional?: string;
};

/** Médico de equipe com agenda Google conectada a outra clínica (não titular). */
export async function resolveEquipeMembership(params: {
  sessionEmail: string;
  googleSub?: string | null;
}): Promise<EquipeMembership> {
  const sessionEmail = params.sessionEmail.toLowerCase().trim();
  const googleSub = params.googleSub?.trim() ?? '';

  if (!sessionEmail) {
    return { isEquipe: false };
  }

  if (googleSub && !INVALID_GOOGLE_SUB.has(googleSub)) {
    const { data: calRows, error } = await supabaseAdmin
      .from('profissional_google_calendar')
      .select('clinica_medicos_id, connected_at')
      .eq('google_sub', googleSub)
      .not('connected_at', 'is', null);

    if (error) {
      console.error('[clinicaTitular] calendar lookup:', error);
      return { isEquipe: false };
    }

    if (calRows?.length) {
      const medicoIds = calRows
        .map((row) => row.clinica_medicos_id)
        .filter((id): id is string | number => id != null);

      if (medicoIds.length) {
        const { data: medicos, error: medErr } = await supabaseAdmin
          .from('clinica_medicos')
          .select('nome, clinica_email')
          .in('id', medicoIds);

        if (medErr) {
          console.error('[clinicaTitular] medico lookup:', medErr);
          return { isEquipe: false };
        }

        const equipe = medicos?.find(
          (m) => String(m.clinica_email ?? '').toLowerCase().trim() !== sessionEmail,
        );

        if (equipe) {
          return {
            isEquipe: true,
            clinicaEmail: String(equipe.clinica_email).toLowerCase().trim(),
            nomeProfissional: String(equipe.nome ?? '').trim() || 'Médico',
          };
        }
      }
    }
  }

  const { data: medico, error: medErr } = await supabaseAdmin
    .from('clinica_medicos')
    .select('id, nome, clinica_email')
    .eq('email', sessionEmail)
    .maybeSingle();

  if (medErr) {
    console.error('[clinicaTitular] medico email lookup:', medErr);
    return { isEquipe: false };
  }

  if (!medico?.id) {
    return { isEquipe: false };
  }

  const ownerEmail = String(medico.clinica_email ?? '').toLowerCase().trim();
  if (!ownerEmail || ownerEmail === sessionEmail) {
    return { isEquipe: false };
  }

  const { data: calRow, error: calErr } = await supabaseAdmin
    .from('profissional_google_calendar')
    .select('connected_at, refresh_token_encrypted')
    .eq('clinica_medicos_id', medico.id)
    .maybeSingle();

  if (calErr) {
    console.error('[clinicaTitular] calendar email lookup:', calErr);
    return { isEquipe: false };
  }

  if (!calRow?.connected_at || !calRow.refresh_token_encrypted) {
    return { isEquipe: false };
  }

  return {
    isEquipe: true,
    clinicaEmail: ownerEmail,
    nomeProfissional: String(medico.nome ?? '').trim() || 'Médico',
  };
}

/** Titular da conta (owner_email) — não é profissional de equipe com agenda conectada. */
export async function isClinicaTitular(session: Session | null): Promise<boolean> {
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) return false;

  const membership = await resolveEquipeMembership({
    sessionEmail: email,
    googleSub: session?.googleSub,
  });

  return !membership.isEquipe;
}
