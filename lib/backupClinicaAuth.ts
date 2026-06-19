import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { buildProntuarioAccessStatus } from '@/lib/prontuarioAcesso';

export async function getOwnerUserType(
  ownerEmail: string,
): Promise<'medico' | 'clinica' | null> {
  const email = ownerEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from('onboarding_profiles')
    .select('user_type')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('[backupClinicaAuth] user_type:', error);
    return null;
  }

  const t = data?.user_type;
  if (t === 'clinica' || t === 'medico') return t;
  return null;
}

/**
 * Contas clínica: PIN configurado + desbloqueado obrigatórios para qualquer export de backup.
 * Contas médico: sem exigência extra aqui (seções sensíveis tratadas em backup/dados).
 */
export async function requireClinicaBackupExportAccess(
  ownerEmail: string,
  req: NextRequest,
): Promise<NextResponse | null> {
  const userType = await getOwnerUserType(ownerEmail);
  if (userType !== 'clinica') return null;

  const access = await buildProntuarioAccessStatus(ownerEmail, req);

  if (!access.pinConfigured) {
    return NextResponse.json(
      {
        error:
          'Configure um PIN do prontuário em Meu Perfil antes de exportar backup.',
        code: 'PRONTUARIO_PIN_NOT_CONFIGURED',
      },
      { status: 403 },
    );
  }

  if (access.modoRecepcao) {
    return NextResponse.json(
      {
        error: 'Exportação de backup indisponível no modo recepção.',
        code: 'MODO_RECEPCAO',
      },
      { status: 403 },
    );
  }

  if (!access.unlocked) {
    return NextResponse.json(
      {
        error: 'Informe o PIN do prontuário para exportar backup.',
        code: 'PRONTUARIO_LOCKED',
      },
      { status: 403 },
    );
  }

  return null;
}
