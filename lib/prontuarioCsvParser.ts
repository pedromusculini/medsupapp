import {
  CHART_NUMERIC_KEYS,
  type ProntuarioEntrada,
  entradaHash,
} from '@/lib/prontuarioEntradasDrive';

export type CsvColumnMapping = {
  data?: string;
  hora?: string;
  medico?: string;
  texto?: string;
  tipo?: string;
  campo?: string;
  valor?: string;
  unidade?: string;
  numericColumns: Record<string, string>;
};

export type ParsedCsvRow = Record<string, string>;

export type CsvParseIssue = {
  linha: number;
  motivo: string;
};

export type CsvImportPreview = {
  layout: 'wide' | 'long';
  delimiter: ';' | ',';
  mapping: CsvColumnMapping;
  headers: string[];
  /** Linhas de dados processadas (após eventual truncamento). */
  totalLinhas: number;
  /** Total de linhas de dados no arquivo (antes do truncamento). */
  totalLinhasArquivo: number;
  linhasTruncadas: boolean;
  previewRows: ProntuarioEntrada[];
  erros: CsvParseIssue[];
  avisos: string[];
  entradasValidas: number;
  entradasInvalidas: number;
};

export type CsvParseOptions = {
  /** Máximo de linhas de dados a processar; excedente gera aviso. */
  maxDataRows?: number;
};

const DATA_ALIASES = [
  'data',
  'date',
  'dt',
  'dia',
  'when',
  'inicio',
  'atendimento_data',
  'data_atendimento',
  'data consulta',
  'data_consulta',
];

const HORA_ALIASES = ['hora', 'time', 'horario', 'hr', 'horário'];

const TEXTO_ALIASES = [
  'texto',
  'evolucao',
  'evolução',
  'observacao',
  'observação',
  'obs',
  'notas',
  'prontuario',
  'prontuário',
  'descricao',
  'descrição',
  'conduta',
  'anotacao',
  'anotação',
];

const MEDICO_ALIASES = [
  'medico',
  'médico',
  'profissional',
  'dr',
  'dra',
  'autor',
  'provider',
  'responsavel',
  'responsável',
];

const TIPO_ALIASES = ['tipo', 'type', 'categoria'];

const CAMPO_ALIASES = ['campo', 'field', 'parametro', 'parâmetro', 'medida', 'item'];

const VALOR_ALIASES = ['valor', 'value', 'resultado', 'measure'];

const NUMERIC_HEADER_MAP: Record<string, string> = {
  peso: 'peso_kg',
  peso_kg: 'peso_kg',
  'peso kg': 'peso_kg',
  'peso (kg)': 'peso_kg',
  altura: 'altura_cm',
  altura_cm: 'altura_cm',
  'altura cm': 'altura_cm',
  'altura (cm)': 'altura_cm',
  imc: 'imc',
  pa: 'pa_sistolica',
  pa_sistolica: 'pa_sistolica',
  'pa sistolica': 'pa_sistolica',
  'pa sistólica': 'pa_sistolica',
  sistolica: 'pa_sistolica',
  sistólica: 'pa_sistolica',
  pa_diastolica: 'pa_diastolica',
  'pa diastolica': 'pa_diastolica',
  'pa diastólica': 'pa_diastolica',
  diastolica: 'pa_diastolica',
  diastólica: 'pa_diastolica',
  glicemia: 'glicemia',
  glicose: 'glicemia',
  freq_cardiaca: 'freq_cardiaca',
  'freq cardiaca': 'freq_cardiaca',
  fc: 'freq_cardiaca',
  temperatura: 'temperatura',
  temp: 'temperatura',
  saturacao: 'saturacao',
  saturação: 'saturacao',
  spo2: 'saturacao',
  perimetro_cefalico: 'perimetro_cefalico',
  'perimetro cefalico': 'perimetro_cefalico',
  'perímetro cefálico': 'perimetro_cefalico',
  pc: 'perimetro_cefalico',
  'pc (cm)': 'perimetro_cefalico',
  hba1c: 'hba1c',
  hemoglobina_glicada: 'hba1c',
  'hb a1c': 'hba1c',
  ldl: 'ldl',
  'ldl-c': 'ldl',
  hdl: 'hdl',
  'hdl-c': 'hdl',
  triglicerides: 'triglicerides',
  triglicerídeos: 'triglicerides',
  tg: 'triglicerides',
  creatinina: 'creatinina',
  tfg: 'tfg',
  'taxa filtracao glomerular': 'tfg',
  fev1: 'fev1',
  cvf: 'cvf',
  vef1_cvf: 'vef1_cvf',
  'vef1/cvf': 'vef1_cvf',
  cea: 'cea',
  ca125: 'ca125',
  'ca-125': 'ca125',
  psa: 'psa',
  afp: 'afp',
  ca19_9: 'ca19_9',
  'ca 19-9': 'ca19_9',
  ldh: 'ldh',
  sumatorio_lesoes_mm: 'sumatorio_lesoes_mm',
  'soma lesoes': 'sumatorio_lesoes_mm',
  'sumatorio lesoes': 'sumatorio_lesoes_mm',
  carga_tumoral_pct: 'carga_tumoral_pct',
  'carga tumoral': 'carga_tumoral_pct',
  pasi: 'pasi',
  scorad: 'scorad',
  dlqi: 'dlqi',
  phq9: 'phq9',
  'phq-9': 'phq9',
  gad7: 'gad7',
  'gad-7': 'gad7',
  eva_dor: 'eva_dor',
  eva: 'eva_dor',
  dor: 'eva_dor',
  ig_semanas: 'ig_semanas',
  'ig semanas': 'ig_semanas',
  altura_uterina_cm: 'altura_uterina_cm',
  'altura uterina': 'altura_uterina_cm',
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAlias(header: string, aliases: string[]): boolean {
  const n = normalizeHeader(header);
  return aliases.some((a) => normalizeHeader(a) === n);
}

function findColumn(headers: string[], aliases: string[]): string | undefined {
  return headers.find((h) => matchAlias(h, aliases));
}

function detectDelimiter(firstLine: string): ';' | ',' {
  const semi = (firstLine.match(/;/g) ?? []).length;
  const comma = (firstLine.match(/,/g) ?? []).length;
  return comma > semi ? ',' : ';';
}

/** Parser CSV com suporte a aspas e quebras de linha dentro de células. */
export function parseCsvRows(raw: string, delimiter?: ';' | ','): string[][] {
  const text = raw.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      if (ch === '\r') i++;
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }

  return rows;
}

function rowsToObjects(headers: string[], dataRows: string[][]): ParsedCsvRow[] {
  return dataRows.map((cells) => {
    const obj: ParsedCsvRow = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim();
    });
    return obj;
  });
}

function findColumnWithResolved(
  headers: string[],
  resolved: string[],
  aliases: string[],
): string | undefined {
  const idx = resolved.findIndex((h) => matchAlias(h, aliases));
  return idx >= 0 ? headers[idx] : undefined;
}

export function buildColumnMapping(
  headers: string[],
  customMappings?: { aliases?: Record<string, string>; numericFields?: Record<string, { key: string }> } | null,
): CsvColumnMapping {
  const mapping: CsvColumnMapping = { numericColumns: {} };

  const resolvedHeaders = headers.map((h) => customMappings?.aliases?.[h] ?? h);

  mapping.data =
    findColumnWithResolved(headers, resolvedHeaders, DATA_ALIASES) ??
    findColumn(headers, DATA_ALIASES);
  mapping.hora =
    findColumnWithResolved(headers, resolvedHeaders, HORA_ALIASES) ??
    findColumn(headers, HORA_ALIASES);
  mapping.medico =
    findColumnWithResolved(headers, resolvedHeaders, MEDICO_ALIASES) ??
    findColumn(headers, MEDICO_ALIASES);
  mapping.texto =
    findColumnWithResolved(headers, resolvedHeaders, TEXTO_ALIASES) ??
    findColumn(headers, TEXTO_ALIASES);
  mapping.tipo =
    findColumnWithResolved(headers, resolvedHeaders, TIPO_ALIASES) ??
    findColumn(headers, TIPO_ALIASES);
  mapping.campo =
    findColumnWithResolved(headers, resolvedHeaders, CAMPO_ALIASES) ??
    findColumn(headers, CAMPO_ALIASES);
  mapping.valor =
    findColumnWithResolved(headers, resolvedHeaders, VALOR_ALIASES) ??
    findColumn(headers, VALOR_ALIASES);

  // Mapear colunas reais (não só resolvidas)
  for (const h of headers) {
    const norm = normalizeHeader(customMappings?.aliases?.[h] ?? h);
    const known = NUMERIC_HEADER_MAP[norm];
    if (known && CHART_NUMERIC_KEYS.has(known)) {
      mapping.numericColumns[h] = known;
    }
  }

  if (customMappings?.numericFields) {
    for (const [header, cfg] of Object.entries(customMappings.numericFields)) {
      if (headers.includes(header) || resolvedHeaders.includes(header)) {
        mapping.numericColumns[header] = cfg.key;
      }
    }
  }

  return mapping;
}

function remapRowAliases(
  row: ParsedCsvRow,
  headers: string[],
  customMappings?: { aliases?: Record<string, string> } | null,
): ParsedCsvRow {
  if (!customMappings?.aliases) return row;
  const out = { ...row };
  for (const h of headers) {
    const target = customMappings.aliases[h];
    if (target && row[h] !== undefined) {
      out[target] = row[h];
    }
  }
  return out;
}

function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : t;
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? null : n;
}

/** Excel serial date (dias desde 1899-12-30). */
function excelSerialToDate(serial: number): { data: string; hora: string | null } | null {
  if (serial < 1 || serial > 60000) return null;
  const utc = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
  const frac = serial - Math.floor(serial);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  let hora: string | null = null;
  if (frac > 0.0001) {
    const totalMin = Math.round(frac * 24 * 60);
    const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const mm = String(totalMin % 60).padStart(2, '0');
    hora = `${hh}:${mm}`;
  }
  return { data: `${y}-${m}-${d}`, hora };
}

export function parseFlexibleDate(raw: string): { data: string; hora: string | null } | null {
  const t = raw.trim();
  if (!t) return null;

  const num = Number(t);
  if (/^\d+(\.\d+)?$/.test(t) && num > 30000 && num < 60000) {
    return excelSerialToDate(num);
  }

  const brDateTime = t.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (brDateTime) {
    let [, dd, mm, yy, hh, mi] = brDateTime;
    let year = parseInt(yy, 10);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const data = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    const hora = hh ? `${hh.padStart(2, '0')}:${mi.padStart(2, '0')}` : null;
    return { data, hora };
  }

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (iso) {
    const [, y, m, d, hh, mi] = iso;
    return {
      data: `${y}-${m}-${d}`,
      hora: hh ? `${hh}:${mi}` : null,
    };
  }

  const parsed = Date.parse(t);
  if (!Number.isNaN(parsed)) {
    const dt = new Date(parsed);
    const data = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const hora = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    return { data, hora: hora === '00:00' && !/\d{1,2}:\d{2}/.test(t) ? null : hora };
  }

  return null;
}

function parseHoraOnly(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return null;
}

function rowHashForEntrada(e: Omit<ProntuarioEntrada, 'id' | 'origem' | 'importado_em'>): string {
  return entradaHash({
    data: e.data,
    hora: e.hora,
    medico: e.medico,
    texto: e.texto,
    campos: e.campos,
  });
}

function newEntradaId(): string {
  return crypto.randomUUID();
}

function buildWideEntrada(
  row: ParsedCsvRow,
  mapping: CsvColumnMapping,
  linha: number,
): { entrada: ProntuarioEntrada | null; erro?: string } {
  const dataCol = mapping.data;
  if (!dataCol) return { entrada: null, erro: 'Coluna de data não identificada' };

  const rawData = row[dataCol] ?? '';
  const parsedDate = parseFlexibleDate(rawData);
  if (!parsedDate) {
    return { entrada: null, erro: `Data inválida: "${rawData}"` };
  }

  let hora = mapping.hora ? parseHoraOnly(row[mapping.hora] ?? '') : null;
  if (!hora && parsedDate.hora) hora = parsedDate.hora;

  const texto = mapping.texto ? (row[mapping.texto] ?? '').trim() : '';
  const medico = mapping.medico ? (row[mapping.medico] ?? '').trim() || null : null;
  const tipo = mapping.tipo ? (row[mapping.tipo] ?? '').trim() || null : null;

  const campos: Record<string, number | string | null> = {};
  for (const [header, key] of Object.entries(mapping.numericColumns)) {
    const num = parseNumber(row[header] ?? '');
    if (num != null) campos[key] = num;
  }

  if (!texto && Object.keys(campos).length === 0) {
    return { entrada: null, erro: 'Linha sem texto nem medidas numéricas' };
  }

  const base = {
    data: parsedDate.data,
    hora,
    medico,
    texto,
    tipo,
    campos,
  };

  const hash = rowHashForEntrada(base);
  return {
    entrada: {
      id: newEntradaId(),
      ...base,
      origem: 'csv_import',
      hash_linha: hash,
    },
  };
}

function buildLongEntradas(
  rows: ParsedCsvRow[],
  mapping: CsvColumnMapping,
): { entradas: ProntuarioEntrada[]; erros: CsvParseIssue[] } {
  const groups = new Map<
    string,
    {
      data: string;
      hora: string | null;
      medico: string | null;
      tipo: string | null;
      textos: string[];
      campos: Record<string, number | string | null>;
      linhas: number[];
    }
  >();

  const erros: CsvParseIssue[] = [];

  rows.forEach((row, idx) => {
    const linha = idx + 2;
    const dataCol = mapping.data!;
    const rawData = row[dataCol] ?? '';
    const parsedDate = parseFlexibleDate(rawData);
    if (!parsedDate) {
      erros.push({ linha, motivo: `Data inválida: "${rawData}"` });
      return;
    }

    let hora = mapping.hora ? parseHoraOnly(row[mapping.hora] ?? '') : null;
    if (!hora && parsedDate.hora) hora = parsedDate.hora;
    const medico = mapping.medico ? (row[mapping.medico] ?? '').trim() || null : null;
    const tipo = mapping.tipo ? (row[mapping.tipo] ?? '').trim() || null : null;
    const key = `${parsedDate.data}|${hora ?? ''}|${medico ?? ''}|${tipo ?? ''}`;

    if (!groups.has(key)) {
      groups.set(key, {
        data: parsedDate.data,
        hora,
        medico,
        tipo,
        textos: [],
        campos: {},
        linhas: [],
      });
    }
    const g = groups.get(key)!;
    g.linhas.push(linha);

    const campoNome = mapping.campo ? (row[mapping.campo] ?? '').trim() : '';
    const valorRaw = mapping.valor ? (row[mapping.valor] ?? '').trim() : '';

    if (campoNome && valorRaw) {
      const normCampo = normalizeHeader(campoNome);
      const knownKey = NUMERIC_HEADER_MAP[normCampo] ?? normCampo.replace(/\s+/g, '_');
      const num = parseNumber(valorRaw);
      if (num != null && CHART_NUMERIC_KEYS.has(knownKey)) {
        g.campos[knownKey] = num;
      } else if (matchAlias(campoNome, TEXTO_ALIASES) || normCampo.includes('texto')) {
        g.textos.push(valorRaw);
      } else {
        g.campos[knownKey] = num ?? valorRaw;
      }
    } else if (mapping.texto && row[mapping.texto]?.trim()) {
      g.textos.push(row[mapping.texto].trim());
    }
  });

  const entradas: ProntuarioEntrada[] = [];
  for (const g of groups.values()) {
    const texto = g.textos.join('\n\n').trim();
    if (!texto && Object.keys(g.campos).length === 0) {
      for (const ln of g.linhas) {
        erros.push({ linha: ln, motivo: 'Grupo sem texto nem medidas' });
      }
      continue;
    }
    const base = {
      data: g.data,
      hora: g.hora,
      medico: g.medico,
      texto,
      tipo: g.tipo,
      campos: g.campos,
    };
    entradas.push({
      id: newEntradaId(),
      ...base,
      origem: 'csv_import',
      hash_linha: rowHashForEntrada(base),
    });
  }

  return { entradas, erros };
}

type ParseResult = {
  layout: 'wide' | 'long';
  delimiter: ';' | ',';
  mapping: CsvColumnMapping;
  headers: string[];
  totalLinhas: number;
  totalLinhasArquivo: number;
  linhasTruncadas: boolean;
  entradas: ProntuarioEntrada[];
  erros: CsvParseIssue[];
  avisos: string[];
};

function parseEntradasFromCsv(
  raw: string,
  customMappings?: { aliases?: Record<string, string>; numericFields?: Record<string, { key: string }> } | null,
  options?: CsvParseOptions,
): ParseResult {
  const avisos: string[] = [];
  const erros: CsvParseIssue[] = [];

  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return {
      layout: 'wide',
      delimiter: ';',
      mapping: { numericColumns: {} },
      headers: [],
      totalLinhas: 0,
      totalLinhasArquivo: 0,
      linhasTruncadas: false,
      entradas: [],
      erros: [{ linha: 0, motivo: 'Arquivo vazio' }],
      avisos: [],
    };
  }

  const firstLine = trimmed.split(/\r?\n/)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const matrix = parseCsvRows(trimmed, delimiter);
  if (matrix.length < 1) {
    return {
      layout: 'wide',
      delimiter,
      mapping: { numericColumns: {} },
      headers: [],
      totalLinhas: 0,
      totalLinhasArquivo: 0,
      linhasTruncadas: false,
      entradas: [],
      erros: [{ linha: 0, motivo: 'Nenhuma linha encontrada' }],
      avisos: [],
    };
  }

  const headers = matrix[0].map((h) => h.trim());
  const allDataRows = matrix.slice(1);
  const totalLinhasArquivo = allDataRows.length;
  const maxDataRows = options?.maxDataRows;
  let linhasTruncadas = false;
  let dataRows = allDataRows;

  if (maxDataRows != null && maxDataRows > 0 && totalLinhasArquivo > maxDataRows) {
    dataRows = allDataRows.slice(0, maxDataRows);
    linhasTruncadas = true;
    avisos.push(
      `O arquivo tem ${totalLinhasArquivo.toLocaleString('pt-BR')} linhas de dados; apenas as primeiras ${maxDataRows.toLocaleString('pt-BR')} foram analisadas. Divida o CSV em partes menores para importar o restante.`,
    );
  }

  const mapping = buildColumnMapping(headers, customMappings);

  if (!mapping.data) {
    avisos.push('Coluna de data não detectada automaticamente — verifique o cabeçalho.');
  }

  const isLong =
    !!mapping.campo &&
    !!mapping.valor &&
    (!mapping.texto ||
      dataRows.every((r) => {
        const obj = rowsToObjects(headers, [r])[0];
        return !(obj[mapping.texto!] ?? '').trim();
      }));

  const layout: 'wide' | 'long' = isLong && mapping.data ? 'long' : 'wide';
  const objects = rowsToObjects(headers, dataRows).map((row) =>
    remapRowAliases(row, headers, customMappings),
  );

  let entradas: ProntuarioEntrada[] = [];

  if (layout === 'long' && mapping.data && mapping.campo && mapping.valor) {
    const result = buildLongEntradas(objects, mapping);
    entradas = result.entradas;
    erros.push(...result.erros);
  } else {
    objects.forEach((row, idx) => {
      const linha = idx + 2;
      const { entrada, erro } = buildWideEntrada(row, mapping, linha);
      if (entrada) entradas.push(entrada);
      else if (erro) erros.push({ linha, motivo: erro });
    });
  }

  entradas.sort((a, b) => {
    const da = `${a.data}T${a.hora ?? '00:00'}`;
    const db = `${b.data}T${b.hora ?? '00:00'}`;
    return da.localeCompare(db);
  });

  const now = new Date().toISOString();
  entradas = entradas.map((e) => ({ ...e, importado_em: now }));

  if (delimiter === ',') {
    avisos.push('Delimitador detectado como vírgula (,) — convertido automaticamente.');
  }
  if (!mapping.texto && layout === 'wide') {
    avisos.push('Coluna de texto/evolução não detectada — linhas numéricas ainda podem importar.');
  }

  return {
    layout,
    delimiter,
    mapping,
    headers,
    totalLinhas: dataRows.length,
    totalLinhasArquivo,
    linhasTruncadas,
    entradas,
    erros,
    avisos,
  };
}

function toCsvImportPreview(result: ParseResult): CsvImportPreview {
  return {
    layout: result.layout,
    delimiter: result.delimiter,
    mapping: result.mapping,
    headers: result.headers,
    totalLinhas: result.totalLinhas,
    totalLinhasArquivo: result.totalLinhasArquivo,
    linhasTruncadas: result.linhasTruncadas,
    previewRows: result.entradas.slice(0, 50),
    erros: result.erros.slice(0, 100),
    avisos: result.avisos,
    entradasValidas: result.entradas.length,
    entradasInvalidas: result.erros.length,
  };
}

export function parseProntuarioCsv(
  raw: string,
  customMappings?: { aliases?: Record<string, string>; numericFields?: Record<string, { key: string }> } | null,
  options?: CsvParseOptions,
): CsvImportPreview {
  const result = parseEntradasFromCsv(raw, customMappings, options);
  return toCsvImportPreview(result);
}

export function parseProntuarioCsvEntradas(
  raw: string,
  customMappings?: { aliases?: Record<string, string>; numericFields?: Record<string, { key: string }> } | null,
  options?: CsvParseOptions,
): {
  entradas: ProntuarioEntrada[];
  preview: CsvImportPreview;
} {
  const result = parseEntradasFromCsv(raw, customMappings, options);
  return { entradas: result.entradas, preview: toCsvImportPreview(result) };
}
