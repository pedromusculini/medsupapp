import {
  backupEntradasBeforeReplace,
  isDuplicateEntrada,
  loadProntuarioEntradas,
  saveProntuarioEntradas,
  sortEntradas,
  type ProntuarioEntrada,
} from '@/lib/prontuarioEntradasDrive';
import { parseProntuarioCsvEntradas, type CsvParseOptions } from '@/lib/prontuarioCsvParser';
import type { ProntuarioImportMappings } from '@/lib/backupDriveExport';

export type ImportMode = 'append' | 'replace';

export type ImportCommitResult = {
  importadas: number;
  duplicadas: number;
  ignoradas: number;
  erros: { linha: number; motivo: string }[];
  backup: string | null;
  totalEntradas: number;
};

export async function commitProntuarioCsvImport(params: {
  accessToken: string;
  clienteDriveId: string;
  csvText: string;
  mode: ImportMode;
  mappings?: ProntuarioImportMappings | null;
  parseOptions?: CsvParseOptions;
}): Promise<{ result: ImportCommitResult; preview: ReturnType<typeof parseProntuarioCsvEntradas>['preview'] }> {
  const { entradas: novas, preview } = parseProntuarioCsvEntradas(
    params.csvText,
    params.mappings ?? null,
    params.parseOptions,
  );

  if (novas.length === 0 && preview.erros.length > 0) {
    return {
      preview,
      result: {
        importadas: 0,
        duplicadas: 0,
        ignoradas: preview.erros.length,
        erros: preview.erros,
        backup: null,
        totalEntradas: 0,
      },
    };
  }

  let backup: string | null = null;
  let store = await loadProntuarioEntradas(params.accessToken, params.clienteDriveId);

  if (params.mode === 'replace') {
    backup = await backupEntradasBeforeReplace(params.accessToken, params.clienteDriveId);
    store = {
      version: 1,
      cliente_id: params.clienteDriveId,
      atualizado_em: new Date().toISOString(),
      entradas: [],
    };
  }

  let importadas = 0;
  let duplicadas = 0;

  for (const entrada of novas) {
    const hash = entrada.hash_linha;
    if (hash && isDuplicateEntrada(store.entradas, hash)) {
      duplicadas++;
      continue;
    }
    store.entradas.push(entrada);
    importadas++;
  }

  store.entradas = sortEntradas(store.entradas);
  await saveProntuarioEntradas(params.accessToken, params.clienteDriveId, store);

  return {
    preview,
    result: {
      importadas,
      duplicadas,
      ignoradas: preview.erros.length,
      erros: preview.erros,
      backup,
      totalEntradas: store.entradas.length,
    },
  };
}

export function countExistingEntradas(entradas: ProntuarioEntrada[]): number {
  return entradas.length;
}
