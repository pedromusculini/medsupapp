'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  CATALOG_MEASURE_KEYS,
  chartsForGroup,
  CLINICAL_CHART_CATALOG,
  findChart,
} from '@/lib/clinicalCharts/catalog';
import type { ClinicalChartDef, ClinicalChartGroup } from '@/lib/clinicalCharts/types';
import { CLINICAL_CHART_GROUPS } from '@/lib/clinicalCharts/types';
import { buildLmsChartData, buildTimeChartData } from '@/lib/clinicalCharts/buildChartData';
import { measureLabel } from '@/lib/clinicalCharts/measureKeys';
import {
  discoverPlainSeries,
  formatDateLabel,
  imcMeasuresFromSeries,
  measuresFromSeries,
  parsePatientSex,
} from '@/lib/clinicalCharts/seriesUtils';
import { suggestGroupFromSpecialty } from '@/lib/clinicalCharts/suggestGroup';
import { formatAgeMonthsLabel, ageInMonths } from '@/lib/growthCharts/lms';
import { suggestedChartsForAge } from '@/lib/growthCharts/catalog';

type SeriePonto = {
  data: string;
  hora: string | null;
  valor: number;
};

type ClinicalChartsPanelProps = {
  birthDate: string | null;
  sexo: string | null;
  series: Record<string, SeriePonto[]>;
};

const LMS_CURVE_COLORS: Record<number, string> = {
  [-3]: '#fca5a5',
  [-2]: '#fdba74',
  [-1]: '#fde047',
  0: '#86efac',
  1: '#fde047',
  2: '#fdba74',
  3: '#fca5a5',
};

function resolveMeasures(
  chart: ClinicalChartDef,
  series: Record<string, SeriePonto[]>,
): { date: string; value: number }[] {
  if (chart.measureKey === 'imc') return imcMeasuresFromSeries(series);
  return measuresFromSeries(series, chart.measureKey);
}

function plainChartDef(key: string): ClinicalChartDef {
  return {
    id: `plain-${key}`,
    group: 'geral',
    kind: 'time-plain',
    label: measureLabel(key),
    measureKey: key,
    yLabel: measureLabel(key),
    source: 'Medidas importadas',
  };
}

export default function ClinicalChartsPanel({
  birthDate,
  sexo,
  series,
}: ClinicalChartsPanelProps) {
  const [group, setGroup] = useState<ClinicalChartGroup>('cardiometabolico');
  const [chartId, setChartId] = useState<string>('esc-pa-sistolica');
  const [plainKey, setPlainKey] = useState<string>('');

  useEffect(() => {
    void fetch('/api/perfil')
      .then((r) => r.json())
      .then((d) => {
        const sp = d?.profile?.specialty as string | undefined;
        if (sp) setGroup(suggestGroupFromSpecialty(sp));
      })
      .catch(() => {});
  }, []);

  const sex = parsePatientSex(sexo);
  const ageNow = birthDate
    ? ageInMonths(birthDate, new Date().toISOString().slice(0, 10))
    : NaN;

  const plainKeys = useMemo(
    () => discoverPlainSeries(series, CATALOG_MEASURE_KEYS),
    [series],
  );

  const groupCharts = useMemo(() => chartsForGroup(group), [group]);

  useEffect(() => {
    if (group === 'geral') {
      if (plainKeys.length > 0) setPlainKey(plainKeys[0]);
      return;
    }
    if (group === 'pediatria' && birthDate && sex && Number.isFinite(ageNow)) {
      const sug = suggestedChartsForAge(ageNow);
      if (sug[0]) setChartId(sug[0].id);
      return;
    }
    const first = groupCharts[0];
    if (first) setChartId(first.id);
  }, [group, groupCharts, plainKeys, birthDate, sex, ageNow]);

  const chart = useMemo((): ClinicalChartDef => {
    if (group === 'geral' && plainKey) return plainChartDef(plainKey);
    return findChart(chartId) ?? groupCharts[0] ?? CLINICAL_CHART_CATALOG[0];
  }, [group, plainKey, chartId, groupCharts]);

  const measures = useMemo(() => resolveMeasures(chart, series), [chart, series]);

  const lmsData = useMemo(() => {
    if (chart.kind !== 'lms-age' || !birthDate || !sex) return null;
    return buildLmsChartData({ chart, sex, birthDate, measures });
  }, [chart, birthDate, sex, measures]);

  const timeData = useMemo(() => {
    if (chart.kind === 'lms-age') return null;
    return buildTimeChartData({ chart, measures });
  }, [chart, measures]);

  const hasData =
    chart.kind === 'lms-age'
      ? (lmsData?.scatterData.length ?? 0) > 0
      : (timeData?.lineData.length ?? 0) > 0;

  const pediatriaBlocked =
    chart.kind === 'lms-age' && (!birthDate || !sex);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div>
        <p className="font-medium text-gray-900 flex items-center gap-2">
          <LineChartIcon className="w-4 h-4 text-emerald-600" />
          Gráficos clínicos
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          Curvas OMS, metas ESC/ADA, RECIST 1.1 e escalas validadas — dados do prontuário/CSV
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-2">
        {CLINICAL_CHART_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroup(g.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              group === g.id
                ? 'bg-emerald-700 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {group === 'geral' ? (
        plainKeys.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
            Nenhuma série numérica com 2+ medidas fora do catálogo. Importe CSV com colunas
            numéricas (peso, glicemia, marcadores, etc.).
          </p>
        ) : (
          <select
            value={plainKey}
            onChange={(e) => setPlainKey(e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            {plainKeys.map((k) => (
              <option key={k} value={k}>
                {measureLabel(k)}
              </option>
            ))}
          </select>
        )
      ) : (
        <select
          value={chartId}
          onChange={(e) => setChartId(e.target.value)}
          className="w-full sm:min-w-[280px] rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
        >
          {groupCharts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}

      <p className="text-xs text-gray-400">Referência: {chart.source}</p>

      {pediatriaBlocked ? (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-4 py-3">
          Para gráficos OMS, informe <strong>data de nascimento</strong> e{' '}
          <strong>sexo</strong> no cadastro do paciente.
        </p>
      ) : !hasData ? (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
          Nenhuma medida de <strong>{chart.yLabel}</strong>. Use coluna{' '}
          <code className="text-xs bg-gray-200 px-1 rounded">{chart.measureKey}</code> no CSV do
          prontuário.
        </p>
      ) : chart.kind === 'lms-age' && lmsData ? (
        <LmsChartView chart={chart} data={lmsData} />
      ) : timeData ? (
        <TimeChartView chart={chart} data={timeData} />
      ) : null}
    </div>
  );
}

function LmsChartView({
  chart,
  data,
}: {
  chart: ClinicalChartDef;
  data: NonNullable<ReturnType<typeof buildLmsChartData>>;
}) {
  return (
    <>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.plotData} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="ageMonths"
              type="number"
              domain={[chart.ageMinMonths ?? 0, chart.ageMaxMonths ?? 228]}
              tickFormatter={(v) => formatAgeMonthsLabel(Number(v))}
              tick={{ fontSize: 10, fill: '#64748b' }}
            />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={44} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {data.referenceKeys.map(({ key, z, label }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={LMS_CURVE_COLORS[z] ?? '#cbd5e1'}
                strokeWidth={z === 0 ? 2 : 1}
                strokeDasharray={z === 0 ? undefined : '4 3'}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            <Scatter
              name="Paciente"
              data={data.scatterData}
              dataKey="patient"
              fill="#047857"
              stroke="#065f46"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <MeasureList
        items={data.scatterData.map((p) => ({
          date: p.date,
          value: p.patient,
          extra: `Z ${p.zScore.toFixed(2)} · P${Math.round(p.percentile)}`,
        }))}
      />
    </>
  );
}

function TimeChartView({
  chart,
  data,
}: {
  chart: ClinicalChartDef;
  data: NonNullable<ReturnType<typeof buildTimeChartData>>;
}) {
  const lineData = data.lineData.map((p) => ({
    ...p,
    patient: chart.kind === 'time-recist' && chart.measureKey === 'carga_tumoral_pct'
      ? p.value
      : chart.kind === 'time-recist' && p.pctChange != null
        ? p.pctChange
        : p.value,
  }));

  const yDomain = chart.yMax ? [0, chart.yMax] : ['auto', 'auto'];

  return (
    <>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineData} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            {chart.zones?.map((z) => (
              <ReferenceArea
                key={z.label}
                y1={z.min}
                y2={z.max}
                fill={z.color}
                fillOpacity={0.35}
                strokeOpacity={0}
              />
            ))}
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={44} domain={yDomain} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {data.goals.map((g) => (
              <ReferenceLine
                key={g.label}
                y={g.value}
                stroke={g.color ?? '#94a3b8'}
                strokeDasharray="6 4"
                label={{ value: g.label, fontSize: 10, fill: g.color ?? '#64748b' }}
              />
            ))}
            {data.recistGoals?.map((g) => (
              <ReferenceLine
                key={`r-${g.label}`}
                y={g.value}
                stroke={g.color ?? '#94a3b8'}
                strokeDasharray="4 4"
                label={{ value: g.label, fontSize: 10, fill: g.color ?? '#64748b' }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="patient"
              name="Paciente"
              stroke="#047857"
              strokeWidth={2}
              dot={{ fill: '#047857', r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <MeasureList
        items={data.lineData.map((p) => ({
          date: p.date,
          value: p.value,
          extra:
            chart.kind === 'time-recist' && p.pctChange != null && chart.measureKey !== 'carga_tumoral_pct'
              ? `Δ ${p.pctChange.toFixed(1)}% vs basal`
              : undefined,
        }))}
      />
    </>
  );
}

function MeasureList({
  items,
}: {
  items: { date: string; value: number; extra?: string }[];
}) {
  return (
    <ul className="text-xs text-gray-600 space-y-1 border-t border-gray-100 pt-3">
      {items.map((p) => (
        <li key={p.date}>
          <span className="font-medium text-gray-800">{formatDateLabel(p.date)}</span>
          {' — '}
          <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
          {p.extra && <span className="text-gray-500"> · {p.extra}</span>}
        </li>
      ))}
    </ul>
  );
}
