'use client';

import { useMemo, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import type { DispBlockInput } from '@/lib/disponibilidadeSlots';
import { normalizeDisponibilidadeForSave } from '@/lib/disponibilidadeSlots';

const DIAS = [
  { v: 1, l: 'Seg' },
  { v: 2, l: 'Ter' },
  { v: 3, l: 'Qua' },
  { v: 4, l: 'Qui' },
  { v: 5, l: 'Sex' },
  { v: 6, l: 'Sáb' },
  { v: 0, l: 'Dom' },
];

const DIAS_FULL: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

const DURACOES = [20, 30, 40, 50, 60];

const HORAS = Array.from({ length: 18 }, (_, i) => i + 6);
const MINUTOS = ['00', '15', '30', '45'];

const PRESETS = [
  { label: 'Manhã (8h–12h)', inicioH: '8', inicioM: '00', fimH: '12', fimM: '00' },
  { label: 'Tarde (14h–18h)', inicioH: '14', inicioM: '00', fimH: '18', fimM: '00' },
];

type Props = {
  rows: DispBlockInput[];
  onChange: (rows: DispBlockInput[]) => void;
  userType: string;
  medicos: string[];
  saving: boolean;
  onSave: () => void;
};

function blockKey(row: DispBlockInput): string {
  return `${row.dia_semana}|${row.hora_inicio}|${row.hora_fim}|${row.duracao_minutos}|${row.medico_nome ?? ''}`;
}

function formatBlockLabel(row: DispBlockInput): string {
  const slots =
    Math.floor(
      (parseInt(row.hora_fim.slice(0, 2), 10) * 60 +
        parseInt(row.hora_fim.slice(3, 5), 10) -
        (parseInt(row.hora_inicio.slice(0, 2), 10) * 60 +
          parseInt(row.hora_inicio.slice(3, 5), 10))) /
        row.duracao_minutos,
    ) || 0;
  return `${row.hora_inicio.slice(0, 5)}–${row.hora_fim.slice(0, 5)} · consultas de ${row.duracao_minutos} min${slots > 0 ? ` (até ${slots} vagas)` : ''}`;
}

export default function HorariosAgendaEditor({
  rows,
  onChange,
  userType,
  medicos,
  saving,
  onSave,
}: Props) {
  const [diasSel, setDiasSel] = useState<number[]>([1, 2, 3, 4, 5]);
  const [inicioH, setInicioH] = useState('8');
  const [inicioM, setInicioM] = useState('00');
  const [fimH, setFimH] = useState('12');
  const [fimM, setFimM] = useState('00');
  const [duracao, setDuracao] = useState(40);
  const [medicoBulk, setMedicoBulk] = useState<string>('');

  const showMedico = userType === 'clinica' && medicos.length > 0;

  const grouped = useMemo(() => {
    const map = new Map<number, DispBlockInput[]>();
    for (const row of rows) {
      const list = map.get(row.dia_semana) ?? [];
      list.push(row);
      map.set(row.dia_semana, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    }
    return DIAS.filter((d) => map.has(d.v)).map((d) => ({
      dia: d.v,
      label: DIAS_FULL[d.v],
      blocks: map.get(d.v)!,
    }));
  }, [rows]);

  function toggleDia(v: number) {
    setDiasSel((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b),
    );
  }

  function aplicarPreset(preset: (typeof PRESETS)[number]) {
    setInicioH(preset.inicioH);
    setInicioM(preset.inicioM);
    setFimH(preset.fimH);
    setFimM(preset.fimM);
  }

  function aplicarLote() {
    if (diasSel.length === 0) {
      alert('Marque pelo menos um dia da semana.');
      return;
    }
    const hi = `${inicioH.padStart(2, '0')}:${inicioM}`;
    const hf = `${fimH.padStart(2, '0')}:${fimM}`;
    if (hf <= hi) {
      alert('O horário de fim deve ser depois do início.');
      return;
    }
    const med = showMedico && medicoBulk ? medicoBulk : null;
    const novos: DispBlockInput[] = diasSel.map((dia) => ({
      medico_nome: med,
      dia_semana: dia,
      hora_inicio: hi,
      hora_fim: hf,
      duracao_minutos: duracao,
    }));
    const merged = normalizeDisponibilidadeForSave([...rows, ...novos]);
    onChange(merged);
  }

  function removeBlock(row: DispBlockInput) {
    const k = blockKey(row);
    onChange(rows.filter((r) => blockKey(r) !== k));
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Horários para agendamento online</h2>
        <p className="text-sm text-gray-500 mt-1">
          Defina blocos de atendimento (ex.: manhã 8h–12h). O sistema divide em consultas da
          duração escolhida. Horários ocupados no Google Calendar ou já reservados somem do link
          público.
        </p>
      </div>

      <div className="rounded-xl border-2 border-emerald-200/50 bg-emerald-50 p-4 space-y-4">
        <p className="text-sm font-semibold text-emerald-800">Adicionar bloco de horário</p>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => aplicarPreset(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Dias da semana</p>
          <div className="flex flex-wrap gap-2">
            {DIAS.map((d) => {
              const on = diasSel.includes(d.v);
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => toggleDia(d.v)}
                  className={`min-w-[3rem] px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    on
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-200'
                  }`}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setDiasSel(DIAS.map((d) => d.v))}
            className="text-xs text-emerald-600 mt-2 hover:underline"
          >
            Marcar todos
          </button>
          {' · '}
          <button
            type="button"
            onClick={() => setDiasSel([])}
            className="text-xs text-gray-500 hover:underline"
          >
            Limpar dias
          </button>
        </div>

        {showMedico && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Médico {medicos.length > 1 ? '(opcional)' : ''}
            </label>
            <select
              value={medicoBulk}
              onChange={(e) => setMedicoBulk(e.target.value)}
              className="w-full max-w-xs text-sm rounded-lg border border-gray-200 px-3 py-2.5 bg-white"
            >
              <option value="">Todos os médicos</option>
              {medicos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Escolha um médico para horários exclusivos dele, ou deixe em &quot;Todos&quot; para
              valer para toda a equipe.
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Intervalo do bloco</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Início</label>
              <div className="flex gap-1">
                <select
                  value={inicioH}
                  onChange={(e) => setInicioH(e.target.value)}
                  className="text-sm rounded-lg border border-gray-200 px-2 py-2.5 bg-white min-w-[4.5rem]"
                >
                  {HORAS.map((h) => (
                    <option key={h} value={String(h)}>
                      {String(h).padStart(2, '0')}h
                    </option>
                  ))}
                </select>
                <select
                  value={inicioM}
                  onChange={(e) => setInicioM(e.target.value)}
                  className="text-sm rounded-lg border border-gray-200 px-2 py-2.5 bg-white min-w-[4rem]"
                >
                  {MINUTOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <span className="text-gray-400 pb-2">até</span>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Fim</label>
              <div className="flex gap-1">
                <select
                  value={fimH}
                  onChange={(e) => setFimH(e.target.value)}
                  className="text-sm rounded-lg border border-gray-200 px-2 py-2.5 bg-white min-w-[4.5rem]"
                >
                  {HORAS.map((h) => (
                    <option key={h} value={String(h)}>
                      {String(h).padStart(2, '0')}h
                    </option>
                  ))}
                </select>
                <select
                  value={fimM}
                  onChange={(e) => setFimM(e.target.value)}
                  className="text-sm rounded-lg border border-gray-200 px-2 py-2.5 bg-white min-w-[4rem]"
                >
                  {MINUTOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Duração consulta</label>
              <select
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))}
                className="text-sm rounded-lg border border-gray-200 px-3 py-2.5 bg-white"
              >
                {DURACOES.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={aplicarLote}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800"
        >
          <Plus className="w-4 h-4" />
          Adicionar bloco aos dias marcados
        </button>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-800 mb-3">Blocos cadastrados</p>
        {grouped.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Nenhum bloco ainda — use o formulário acima.
          </p>
        ) : (
          <ul className="space-y-3">
            {grouped.map(({ dia, label, blocks }) => (
              <li key={dia} className="rounded-xl border border-gray-100 bg-[#fafafa] p-3">
                <p className="text-xs font-bold text-gray-700 mb-2">{label}</p>
                <div className="flex flex-wrap gap-2">
                  {blocks.map((row) => (
                    <span
                      key={blockKey(row)}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-white border border-gray-200 text-sm"
                    >
                      <span>
                        {formatBlockLabel(row)}
                        {row.medico_nome ? (
                          <span className="text-gray-400 text-xs ml-1">· {row.medico_nome}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBlock(row)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        aria-label="Remover"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="w-full sm:w-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 text-white font-semibold text-sm disabled:opacity-50"
      >
        <Save className="w-4 h-4" /> Salvar horários
      </button>
    </section>
  );
}
