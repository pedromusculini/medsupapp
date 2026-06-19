import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerEmail, isAuthError } from '@/lib/api-auth';
import { requireClinicaBackupExportAccess } from '@/lib/backupClinicaAuth';
import { requireGoogleAccessToken, isDriveError } from '@/lib/driveAuth';
import {
  BACKUP_SECTION_IDS,
  type BackupSectionId,
  sectionsRequireProntuarioPin,
} from '@/lib/backupCatalog';
import { gatherBackupDriveData } from '@/lib/backupDriveExport';
import { loadClientesStore } from '@/lib/clientesDrive';
import {
  BACKUP_ASYNC_PATIENT_THRESHOLD,
  createBackupExportJob,
  getBackupExportJob,
  setBackupExportProgress,
  updateBackupExportJob,
} from '@/lib/backupExportJobs';
import { buildProntuarioAccessStatus } from '@/lib/prontuarioAcesso';

function parseSections(raw: unknown): BackupSectionId[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is BackupSectionId =>
    BACKUP_SECTION_IDS.includes(s as BackupSectionId),
  );
}

async function resolvePatientCount(
  accessToken: string,
  ownerEmail: string,
  pacientes?: string[],
): Promise<number> {
  if (pacientes?.length) return pacientes.length;
  const store = await loadClientesStore(accessToken, ownerEmail);
  return store.clientes.length;
}

async function runBackupExportJob(params: {
  jobId: string;
  accessToken: string;
  ownerEmail: string;
  sections: BackupSectionId[];
  pacientes?: string[];
}): Promise<void> {
  const { jobId, accessToken, ownerEmail, sections, pacientes } = params;
  updateBackupExportJob(jobId, { status: 'running', phase: 'iniciando', percent: 0 });

  try {
    const payload = await gatherBackupDriveData({
      accessToken,
      ownerEmail,
      sections,
      pacientes,
      onProgress: (progress) => setBackupExportProgress(jobId, progress),
    });
    updateBackupExportJob(jobId, {
      status: 'done',
      phase: 'concluido',
      percent: 100,
      result: payload,
    });
  } catch (err) {
    console.error('[backup/dados] job', jobId, err);
    updateBackupExportJob(jobId, {
      status: 'error',
      phase: 'erro',
      percent: 0,
      error: err instanceof Error ? err.message : 'Erro ao coletar dados para backup',
    });
  }
}

async function authorizeBackupRequest(
  email: string,
  req: NextRequest,
  sections: BackupSectionId[],
): Promise<NextResponse | null> {
  const clinicaBlocked = await requireClinicaBackupExportAccess(email, req);
  if (clinicaBlocked) return clinicaBlocked;

  if (sectionsRequireProntuarioPin(sections)) {
    const access = await buildProntuarioAccessStatus(email, req);
    if (access.modoRecepcao) {
      return NextResponse.json(
        { error: 'Backup com dados clínicos indisponível no modo recepção.' },
        { status: 403 },
      );
    }
    if (access.locked) {
      return NextResponse.json(
        {
          error: 'Informe o PIN do prontuário para exportar dados clínicos.',
          code: 'PRONTUARIO_LOCKED',
        },
        { status: 403 },
      );
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;
  const { email } = authResult;

  const body = await req.json().catch(() => ({}));
  const sections = parseSections(body.sections);
  if (sections.length === 0) {
    return NextResponse.json(
      { error: 'Selecione ao menos uma seção para exportar.' },
      { status: 400 },
    );
  }

  const blocked = await authorizeBackupRequest(email, req, sections);
  if (blocked) return blocked;

  const pacientes = Array.isArray(body.pacientes)
    ? body.pacientes.map(String).filter(Boolean)
    : undefined;

  const tokenResult = await requireGoogleAccessToken(req);
  if (isDriveError(tokenResult)) return tokenResult;

  const patientCount = await resolvePatientCount(tokenResult, email, pacientes);
  const useAsync =
    body.async === true || patientCount > BACKUP_ASYNC_PATIENT_THRESHOLD;

  if (useAsync) {
    const job = createBackupExportJob();
    void runBackupExportJob({
      jobId: job.id,
      accessToken: tokenResult,
      ownerEmail: email,
      sections,
      pacientes,
    });
    return NextResponse.json({
      async: true,
      jobId: job.id,
      patientCount,
      status: job.status,
      phase: job.phase,
      percent: job.percent,
    });
  }

  try {
    const payload = await gatherBackupDriveData({
      accessToken: tokenResult,
      ownerEmail: email,
      sections,
      pacientes,
    });
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[backup/dados]', err);
    return NextResponse.json({ error: 'Erro ao coletar dados para backup' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (jobId) {
    const authResult = await requireOwnerEmail();
    if (isAuthError(authResult)) return authResult;

    const job = getBackupExportJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Exportação não encontrada ou expirada' }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      phase: job.phase,
      percent: job.percent,
      detail: job.detail,
      result: job.status === 'done' ? job.result : undefined,
      error: job.error,
    });
  }

  const authResult = await requireOwnerEmail();
  if (isAuthError(authResult)) return authResult;

  const { BACKUP_SECTIONS } = await import('@/lib/backupCatalog');
  return NextResponse.json({ sections: BACKUP_SECTIONS });
}
