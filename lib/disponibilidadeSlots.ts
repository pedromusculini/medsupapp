/** Blocos de disponibilidade: intervalo (ex. 08:00–12:00) dividido em consultas de N minutos. */

export type DispBlockInput = {
  medico_nome: string | null;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
};

/** @deprecated alias — mesma estrutura de bloco */
export type DispSlotInput = DispBlockInput;

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}`;
}

export function addMinutesToTime(hhmm: string, minutes: number): string {
  return minutesToTimeString(parseTimeToMinutes(hhmm.slice(0, 5)) + minutes);
}

function blockKey(row: DispBlockInput): string {
  return `${row.dia_semana}|${row.hora_inicio.slice(0, 5)}|${row.hora_fim.slice(0, 5)}|${row.duracao_minutos}|${row.medico_nome ?? ''}`;
}

/** Junta slots consecutivos (dados antigos) em blocos para a UI. */
function collapseConsecutiveSlots(rows: DispBlockInput[]): DispBlockInput[] {
  const sorted = [...rows].sort((a, b) => {
    const medA = a.medico_nome ?? '';
    const medB = b.medico_nome ?? '';
    if (a.dia_semana !== b.dia_semana) return a.dia_semana - b.dia_semana;
    if (medA !== medB) return medA.localeCompare(medB);
    if (a.duracao_minutos !== b.duracao_minutos) return a.duracao_minutos - b.duracao_minutos;
    return a.hora_inicio.localeCompare(b.hora_inicio);
  });

  const out: DispBlockInput[] = [];
  for (const row of sorted) {
    const hi = row.hora_inicio.slice(0, 5);
    const hf = row.hora_fim.slice(0, 5);
    const dur = row.duracao_minutos || 40;
    const span = parseTimeToMinutes(hf) - parseTimeToMinutes(hi);

    if (span > dur + 2) {
      out.push({ ...row, hora_inicio: hi, hora_fim: hf, duracao_minutos: dur });
      continue;
    }

    const last = out[out.length - 1];
    const sameGroup =
      last &&
      last.dia_semana === row.dia_semana &&
      (last.medico_nome ?? '') === (row.medico_nome ?? '') &&
      last.duracao_minutos === dur &&
      last.hora_fim.slice(0, 5) === hi;

    if (sameGroup) {
      last.hora_fim = hf;
    } else {
      out.push({
        medico_nome: row.medico_nome,
        dia_semana: row.dia_semana,
        hora_inicio: hi,
        hora_fim: hf,
        duracao_minutos: dur,
      });
    }
  }
  return out;
}

/** Carrega linhas do banco para o editor de blocos (sem expandir em slots). */
export function disponibilidadeFromDb(
  rows: Array<{
    medico_nome?: string | null;
    dia_semana: number;
    hora_inicio: string;
    hora_fim: string;
    duracao_minutos?: number;
  }>,
): DispBlockInput[] {
  const normalized = rows.map((row) => ({
    medico_nome: row.medico_nome ?? null,
    dia_semana: row.dia_semana,
    hora_inicio: String(row.hora_inicio).slice(0, 5),
    hora_fim: String(row.hora_fim).slice(0, 5),
    duracao_minutos: row.duracao_minutos ?? 40,
  }));
  return collapseConsecutiveSlots(normalized);
}

/** @deprecated use disponibilidadeFromDb */
export function expandDisponibilidadeForUi(
  rows: Parameters<typeof disponibilidadeFromDb>[0],
): DispBlockInput[] {
  return disponibilidadeFromDb(rows);
}

/** Persistência: cada bloco vira uma linha com hora_fim do intervalo. */
export function normalizeDisponibilidadeForSave(rows: DispBlockInput[]): DispBlockInput[] {
  const seen = new Set<string>();
  const out: DispBlockInput[] = [];

  for (const row of rows) {
    const hi = row.hora_inicio.slice(0, 5);
    let hf = row.hora_fim.slice(0, 5);
    const dur = row.duracao_minutos || 40;
    if (!hi || !hf) continue;

    if (parseTimeToMinutes(hf) <= parseTimeToMinutes(hi)) {
      hf = addMinutesToTime(hi, dur);
    }

    const key = blockKey({ ...row, hora_inicio: hi, hora_fim: hf, duracao_minutos: dur });
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      medico_nome: row.medico_nome,
      dia_semana: row.dia_semana,
      hora_inicio: hi,
      hora_fim: hf,
      duracao_minutos: dur,
    });
  }

  return out.sort((a, b) => {
    if (a.dia_semana !== b.dia_semana) return a.dia_semana - b.dia_semana;
    return a.hora_inicio.localeCompare(b.hora_inicio);
  });
}
