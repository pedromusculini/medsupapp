import {
  loadClientesStore,
  loadFaturamentoStore,
  type ClienteDriveRecord,
} from '@/lib/clientesDrive';
import {
  getAppFolderId,
  listChildrenInFolder,
  readFileInFolder,
  type DriveChildItem,
} from '@/lib/driveNested';
import { baixarArquivoDoDrive } from '@/lib/googleDrive';
import { mapPool } from '@/lib/backupParallel';
import type { BackupExportProgress } from '@/lib/backupExportJobs';
import { isProntuarioObservacao } from '@/lib/prontuarioContent';
import {
  ENTRADAS_FILE,
  PRONTUARIOS_FOLDER,
  SERIES_FILE,
} from '@/lib/prontuarioEntradasDrive';
import type { BackupSectionId } from '@/lib/backupCatalog';
import { getMensagensConfig } from '@/lib/mensagensWhatsapp';
import { getLembretesSettings } from '@/lib/lembretesSettings';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const PRONTUARIO_IMPORT_MAPPINGS_FILE = 'prontuario_import_mappings.json';

export type ProntuarioImportMappings = {
  aliases?: Record<string, string>;
  numericFields?: Record<
    string,
    { key: string; unit?: string; chart?: boolean }
  >;
  dateFormats?: string[];
};

export async function loadProntuarioImportMappings(
  accessToken: string,
): Promise<ProntuarioImportMappings | null> {
  const appId = await getAppFolderId(accessToken);
  const { content } = await readFileInFolder(
    accessToken,
    appId,
    PRONTUARIO_IMPORT_MAPPINGS_FILE,
  );
  if (!content) return null;
  try {
    return JSON.parse(content) as ProntuarioImportMappings;
  } catch {
    return null;
  }
}

export async function saveProntuarioImportMappings(
  accessToken: string,
  mappings: ProntuarioImportMappings,
): Promise<void> {
  const { writeFileInFolder } = await import('@/lib/driveNested');
  const appId = await getAppFolderId(accessToken);
  const json = JSON.stringify(mappings, null, 2);
  await writeFileInFolder(
    accessToken,
    appId,
    PRONTUARIO_IMPORT_MAPPINGS_FILE,
    json,
    'application/json',
  );
}

function filterClientesByNome(
  clientes: ClienteDriveRecord[],
  pacientes?: string[],
): ClienteDriveRecord[] {
  if (!pacientes?.length) return clientes;
  const set = new Set(pacientes.map((p) => p.trim().toLowerCase()));
  return clientes.filter((c) => set.has(c.nome.trim().toLowerCase()));
}

const PRONTUARIO_DOWNLOAD_CONCURRENCY = 5;

function parseDriveJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

async function readPatientProntuarioFiles(
  accessToken: string,
  folder: DriveChildItem,
): Promise<{ entradas?: unknown; series?: unknown }> {
  const children = await listChildrenInFolder(accessToken, folder.id);
  const entFile = children.find((c) => c.name === ENTRADAS_FILE);
  const serFile = children.find((c) => c.name === SERIES_FILE);

  const [entContent, serContent] = await Promise.all([
    entFile ? baixarArquivoDoDrive(accessToken, entFile.id) : Promise.resolve(null),
    serFile ? baixarArquivoDoDrive(accessToken, serFile.id) : Promise.resolve(null),
  ]);

  const out: { entradas?: unknown; series?: unknown } = {};
  if (entContent) out.entradas = parseDriveJson(entContent);
  if (serContent) out.series = parseDriveJson(serContent);
  return out;
}

async function exportProntuarioDriveTree(
  accessToken: string,
  allowedClienteIds: Set<string> | null,
  onProgress?: (progress: BackupExportProgress) => void,
): Promise<{
  entradas: Record<string, unknown>;
  series: Record<string, unknown>;
}> {
  const appId = await getAppFolderId(accessToken);
  const prontuariosRoot = await listChildrenInFolder(accessToken, appId);
  const prontuariosFolder = prontuariosRoot.find(
    (f) => f.name === PRONTUARIOS_FOLDER && f.mimeType.includes('folder'),
  );

  const entradas: Record<string, unknown> = {};
  const series: Record<string, unknown> = {};

  if (!prontuariosFolder) return { entradas, series };

  const patientFolders = (await listChildrenInFolder(accessToken, prontuariosFolder.id)).filter(
    (folder) =>
      folder.mimeType.includes('folder') &&
      (!allowedClienteIds || allowedClienteIds.has(folder.name)),
  );

  const total = patientFolders.length;
  let done = 0;

  onProgress?.({
    phase: 'prontuario',
    percent: total === 0 ? 100 : 0,
    detail: total > 0 ? `0 / ${total} pacientes` : undefined,
  });

  await mapPool(patientFolders, PRONTUARIO_DOWNLOAD_CONCURRENCY, async (folder) => {
    const files = await readPatientProntuarioFiles(accessToken, folder);
    if (files.entradas !== undefined) entradas[folder.name] = files.entradas;
    if (files.series !== undefined) series[folder.name] = files.series;
    done += 1;
    onProgress?.({
      phase: 'prontuario',
      percent: Math.round((done / total) * 100),
      detail: `${done} / ${total} pacientes`,
    });
  });

  return { entradas, series };
}

export type BackupDrivePayload = {
  exportado_em: string;
  sections: Partial<Record<BackupSectionId, unknown>>;
};

export async function gatherBackupDriveData(params: {
  accessToken: string;
  ownerEmail: string;
  sections: BackupSectionId[];
  pacientes?: string[];
  onProgress?: (progress: BackupExportProgress) => void;
}): Promise<BackupDrivePayload> {
  const { accessToken, ownerEmail, sections, pacientes, onProgress } = params;
  const payload: BackupDrivePayload = {
    exportado_em: new Date().toISOString(),
    sections: {},
  };

  const report = (phase: string, percent: number, detail?: string) => {
    onProgress?.({ phase, percent, detail });
  };

  report('preparando', 5);

  const needsClientes = sections.some((s) =>
    [
      'clientes_cadastro',
      'clientes_atendimentos',
      'clientes_pagamentos',
      'clientes_observacoes',
      'prontuario_anotacoes',
    ].includes(s),
  );

  let clientesStore = needsClientes
    ? await loadClientesStore(accessToken, ownerEmail)
    : null;
  let clientes = clientesStore?.clientes ?? [];
  if (pacientes?.length) clientes = filterClientesByNome(clientes, pacientes);

  report('clientes', 15, `${clientes.length} paciente(s)`);

  const allowedClienteIds = pacientes?.length
    ? new Set(clientes.map((c) => c.id))
    : null;

  if (sections.includes('clientes_cadastro') && clientesStore) {
    payload.sections.clientes_cadastro = {
      ...clientesStore,
      clientes: pacientes?.length ? clientes : clientesStore.clientes,
    };
  }

  if (sections.includes('clientes_atendimentos')) {
    payload.sections.clientes_atendimentos = clientes.map((c) => ({
      cliente_id: c.id,
      nome: c.nome,
      atendimentos: c.atendimentos.map((a) => ({
        ...a,
        observacoes: null,
      })),
    }));
  }

  if (sections.includes('clientes_pagamentos')) {
    payload.sections.clientes_pagamentos = clientes.map((c) => ({
      cliente_id: c.id,
      nome: c.nome,
      pagamentos: c.pagamentos,
    }));
  }

  if (sections.includes('clientes_observacoes')) {
    payload.sections.clientes_observacoes = clientes.map((c) => ({
      cliente_id: c.id,
      nome: c.nome,
      observacoes: c.observacoes.filter((o) => !isProntuarioObservacao(o.texto)),
    }));
  }

  if (sections.includes('prontuario_anotacoes')) {
    payload.sections.prontuario_anotacoes = clientes.map((c) => ({
      cliente_id: c.id,
      nome: c.nome,
      observacoes: c.observacoes.filter((o) => isProntuarioObservacao(o.texto)),
      atendimentos_com_prontuario: c.atendimentos.filter((a) => !!a.observacoes?.trim()),
    }));
  }

  if (sections.includes('financeiro_transacoes')) {
    report('financeiro', 25);
    const fin = await loadFaturamentoStore(accessToken, ownerEmail);
    payload.sections.financeiro_transacoes = fin;
  }

  if (sections.includes('prontuario_entradas') || sections.includes('prontuario_series')) {
    const tree = await exportProntuarioDriveTree(
      accessToken,
      allowedClienteIds,
      (p) => report(p.phase, 25 + Math.round(p.percent * 0.45), p.detail),
    );
    if (sections.includes('prontuario_entradas')) {
      payload.sections.prontuario_entradas = tree.entradas;
    }
    if (sections.includes('prontuario_series')) {
      payload.sections.prontuario_series = tree.series;
    }
  }

  if (sections.includes('prontuario_import_mappings')) {
    report('mapeamentos', 85);
    payload.sections.prontuario_import_mappings =
      (await loadProntuarioImportMappings(accessToken)) ?? {};
  }

  if (sections.includes('equipe_medicos')) {
    report('equipe', 88);
    const { data } = await supabaseAdmin
      .from('clinica_medicos')
      .select('id, nome, crm, specialty, email, ativo, created_at')
      .eq('clinica_email', ownerEmail.toLowerCase());
    payload.sections.equipe_medicos = data ?? [];
  }

  if (sections.includes('mensagens_whatsapp')) {
    report('mensagens', 92);
    payload.sections.mensagens_whatsapp = await getMensagensConfig(ownerEmail);
  }

  if (sections.includes('lembretes_whatsapp')) {
    report('lembretes', 95);
    payload.sections.lembretes_whatsapp = await getLembretesSettings(ownerEmail);
  }

  if (sections.includes('perfil_conta')) {
    report('perfil', 98);
    const { data } = await supabaseAdmin
      .from('profiles')
      .select(
        'email, full_name, user_type, phone, specialty, crm, clinic_name, created_at',
      )
      .eq('email', ownerEmail.toLowerCase())
      .maybeSingle();
    payload.sections.perfil_conta = data ?? { email: ownerEmail };
  }

  report('concluido', 100);
  return payload;
}

/** Snapshot completo da pasta MedSupApp (arquivos na raiz). */
export async function listMedSupAppRootFiles(accessToken: string) {
  const appId = await getAppFolderId(accessToken);
  return listChildrenInFolder(accessToken, appId);
}

export async function readMedSupAppFile(
  accessToken: string,
  fileId: string,
): Promise<string> {
  return baixarArquivoDoDrive(accessToken, fileId);
}
