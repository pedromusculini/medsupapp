import type { BackupDrivePayload } from '@/lib/backupDriveExport';

export const BACKUP_ASYNC_PATIENT_THRESHOLD = 100;

export type BackupExportProgress = {
  phase: string;
  percent: number;
  detail?: string;
};

export type BackupExportJob = {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  phase: string;
  percent: number;
  detail?: string;
  result?: BackupDrivePayload;
  error?: string;
  createdAt: number;
};

const JOB_TTL_MS = 30 * 60 * 1000;

const jobs = new Map<string, BackupExportJob>();

function pruneExpiredJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

export function createBackupExportJob(): BackupExportJob {
  pruneExpiredJobs();
  const id = crypto.randomUUID();
  const job: BackupExportJob = {
    id,
    status: 'pending',
    phase: 'preparando',
    percent: 0,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getBackupExportJob(jobId: string): BackupExportJob | null {
  pruneExpiredJobs();
  return jobs.get(jobId) ?? null;
}

export function updateBackupExportJob(
  jobId: string,
  patch: Partial<BackupExportJob>,
): BackupExportJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}

export function setBackupExportProgress(
  jobId: string,
  progress: BackupExportProgress,
): void {
  updateBackupExportJob(jobId, {
    status: 'running',
    phase: progress.phase,
    percent: progress.percent,
    detail: progress.detail,
  });
}
