import {
  findOrCreateFolder,
  getAppFolderId,
  readFileInFolder,
  writeFileInFolder,
} from '@/lib/driveNested';

export const PRONTUARIOS_FOLDER = 'prontuarios';
export const ENTRADAS_FILE = 'entradas.json';
export const SERIES_FILE = 'series.json';
export const BACKUPS_FOLDER = 'backups';

export type ProntuarioEntradaOrigem =
  | 'csv_import'
  | 'manual'
  | 'medico_portal'
  | 'profissional_ficha'
  | 'legado_observacao';

export type ProntuarioEntrada = {
  id: string;
  data: string;
  hora: string | null;
  medico: string | null;
  texto: string;
  tipo: string | null;
  campos: Record<string, number | string | null>;
  origem: ProntuarioEntradaOrigem;
  importado_em?: string;
  hash_linha?: string;
};

export type ProntuarioEntradasStore = {
  version: 1;
  cliente_id: string;
  atualizado_em: string;
  entradas: ProntuarioEntrada[];
};

export type ProntuarioSeriePonto = {
  data: string;
  hora: string | null;
  valor: number;
  entrada_id: string;
};

export type ProntuarioSeriesStore = {
  version: 1;
  cliente_id: string;
  atualizado_em: string;
  series: Record<string, ProntuarioSeriePonto[]>;
};

import { CHART_NUMERIC_KEYS } from '@/lib/clinicalCharts/measureKeys';

export { CHART_NUMERIC_KEYS };

export async function getProntuarioPacienteFolderId(
  accessToken: string,
  clienteDriveId: string,
): Promise<string> {
  const appFolderId = await getAppFolderId(accessToken);
  const prontuariosId = await findOrCreateFolder(accessToken, appFolderId, PRONTUARIOS_FOLDER);
  return findOrCreateFolder(accessToken, prontuariosId, clienteDriveId);
}

function emptyStore(clienteId: string): ProntuarioEntradasStore {
  return {
    version: 1,
    cliente_id: clienteId,
    atualizado_em: new Date().toISOString(),
    entradas: [],
  };
}

export async function loadProntuarioEntradas(
  accessToken: string,
  clienteDriveId: string,
): Promise<ProntuarioEntradasStore> {
  const folderId = await getProntuarioPacienteFolderId(accessToken, clienteDriveId);
  const { content } = await readFileInFolder(accessToken, folderId, ENTRADAS_FILE);
  if (!content) return emptyStore(clienteDriveId);

  try {
    const parsed = JSON.parse(content) as ProntuarioEntradasStore;
    if (!parsed.entradas) parsed.entradas = [];
    parsed.cliente_id = clienteDriveId;
    parsed.version = 1;
    return parsed;
  } catch {
    return emptyStore(clienteDriveId);
  }
}

export async function saveProntuarioEntradas(
  accessToken: string,
  clienteDriveId: string,
  store: ProntuarioEntradasStore,
): Promise<void> {
  const folderId = await getProntuarioPacienteFolderId(accessToken, clienteDriveId);
  store.cliente_id = clienteDriveId;
  store.atualizado_em = new Date().toISOString();
  store.version = 1;
  store.entradas = sortEntradas(store.entradas);
  const json = JSON.stringify(store, null, 2);
  await writeFileInFolder(accessToken, folderId, ENTRADAS_FILE, json, 'application/json');
  await saveProntuarioSeries(accessToken, clienteDriveId, rebuildSeriesFromEntradas(store));
}

export function sortEntradas(entradas: ProntuarioEntrada[]): ProntuarioEntrada[] {
  return [...entradas].sort((a, b) => {
    const da = `${a.data}T${a.hora ?? '00:00'}`;
    const db = `${b.data}T${b.hora ?? '00:00'}`;
    return da.localeCompare(db);
  });
}

export function rebuildSeriesFromEntradas(store: ProntuarioEntradasStore): ProntuarioSeriesStore {
  const series: Record<string, ProntuarioSeriePonto[]> = {};

  for (const entrada of store.entradas) {
    for (const [key, raw] of Object.entries(entrada.campos ?? {})) {
      if (!CHART_NUMERIC_KEYS.has(key)) continue;
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
      if (Number.isNaN(num)) continue;
      if (!series[key]) series[key] = [];
      series[key].push({
        data: entrada.data,
        hora: entrada.hora,
        valor: num,
        entrada_id: entrada.id,
      });
    }
  }

  for (const key of Object.keys(series)) {
    series[key].sort((a, b) => {
      const da = `${a.data}T${a.hora ?? '00:00'}`;
      const db = `${b.data}T${b.hora ?? '00:00'}`;
      return da.localeCompare(db);
    });
  }

  return {
    version: 1,
    cliente_id: store.cliente_id,
    atualizado_em: new Date().toISOString(),
    series,
  };
}

export async function saveProntuarioSeries(
  accessToken: string,
  clienteDriveId: string,
  store: ProntuarioSeriesStore,
): Promise<void> {
  const folderId = await getProntuarioPacienteFolderId(accessToken, clienteDriveId);
  store.cliente_id = clienteDriveId;
  store.atualizado_em = new Date().toISOString();
  const json = JSON.stringify(store, null, 2);
  await writeFileInFolder(accessToken, folderId, SERIES_FILE, json, 'application/json');
}

export async function loadProntuarioSeries(
  accessToken: string,
  clienteDriveId: string,
): Promise<ProntuarioSeriesStore | null> {
  const folderId = await getProntuarioPacienteFolderId(accessToken, clienteDriveId);
  const { content } = await readFileInFolder(accessToken, folderId, SERIES_FILE);
  if (!content) return null;
  try {
    return JSON.parse(content) as ProntuarioSeriesStore;
  } catch {
    return null;
  }
}

function backupTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Backup automático de entradas.json antes de substituir. Retorna nome do backup ou null. */
export async function backupEntradasBeforeReplace(
  accessToken: string,
  clienteDriveId: string,
): Promise<string | null> {
  const folderId = await getProntuarioPacienteFolderId(accessToken, clienteDriveId);
  const { content, fileId } = await readFileInFolder(accessToken, folderId, ENTRADAS_FILE);
  if (!content || !fileId) return null;

  const backupsId = await findOrCreateFolder(accessToken, folderId, BACKUPS_FOLDER);
  const backupName = `entradas_${backupTimestamp()}.json`;
  await writeFileInFolder(accessToken, backupsId, backupName, content, 'application/json');
  return backupName;
}

export function entradaHash(params: {
  data: string;
  hora: string | null;
  medico: string | null;
  texto: string;
  campos?: Record<string, unknown>;
}): string {
  const norm = [
    params.data,
    params.hora ?? '',
    (params.medico ?? '').toLowerCase().trim(),
    params.texto.trim().replace(/\s+/g, ' ').toLowerCase(),
    JSON.stringify(params.campos ?? {}),
  ].join('|');
  let h = 0;
  for (let i = 0; i < norm.length; i++) {
    h = (Math.imul(31, h) + norm.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function isDuplicateEntrada(
  existing: ProntuarioEntrada[],
  hash: string,
): boolean {
  return existing.some((e) => e.hash_linha === hash);
}

export const CSV_TEMPLATE_HEADER =
  'data;hora;medico;texto;tipo;peso_kg;altura_cm;pa_sistolica;pa_diastolica';

export const CSV_TEMPLATE_SAMPLE = [
  CSV_TEMPLATE_HEADER,
  '15/03/2024;14:30;Dr. Silva;Paciente estável, sem queixas.;consulta;12,4;85;110;70',
  '20/04/2024;;Dra. Costa;Retorno — orientações dietéticas.;retorno;12,6;86;;',
].join('\r\n');

export function csvTemplateWithBom(): string {
  return '\uFEFF' + CSV_TEMPLATE_SAMPLE;
}
