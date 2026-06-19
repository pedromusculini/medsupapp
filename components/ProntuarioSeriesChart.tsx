"use client";

type SeriePonto = {
  data: string;
  hora: string | null;
  valor: number;
};

const CHART_LABELS: Record<string, string> = {
  peso_kg: "Peso (kg)",
  altura_cm: "Altura (cm)",
  imc: "IMC",
  pa_sistolica: "PA sistólica",
  pa_diastolica: "PA diastólica",
  glicemia: "Glicemia",
  freq_cardiaca: "FC (bpm)",
  temperatura: "Temperatura (°C)",
  saturacao: "SpO₂ (%)",
  perimetro_cefalico: "Perímetro cefálico (cm)",
};

type Props = {
  series: Record<string, SeriePonto[]>;
};

export default function ProntuarioSeriesChart({ series }: Props) {
  const keys = Object.keys(series).filter((k) => (series[k]?.length ?? 0) >= 2);
  if (keys.length === 0) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Gráficos (medidas importadas)</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {keys.map((key) => {
          const pontos = [...series[key]].sort((a, b) => {
            const da = `${a.data}T${a.hora ?? "00:00"}`;
            const db = `${b.data}T${b.hora ?? "00:00"}`;
            return da.localeCompare(db);
          });
          const valores = pontos.map((p) => p.valor);
          const min = Math.min(...valores);
          const max = Math.max(...valores);
          const range = max - min || 1;
          const w = 280;
          const h = 80;
          const pad = 8;
          const coords = pontos.map((p, i) => {
            const x =
              pad + (pontos.length === 1 ? w / 2 : (i / (pontos.length - 1)) * (w - pad * 2));
            const y = pad + (1 - (p.valor - min) / range) * (h - pad * 2);
            return { x, y, p };
          });
          const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");

          return (
            <div key={key} className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-medium text-gray-600 mb-2">
                {CHART_LABELS[key] ?? key}
              </p>
              <svg
                viewBox={`0 0 ${w} ${h}`}
                className="w-full h-20 text-emerald-600"
                role="img"
                aria-label={`Gráfico ${CHART_LABELS[key] ?? key}`}
              >
                <path
                  d={pathD}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {coords.map((c) => (
                  <circle key={`${c.p.data}-${c.p.valor}`} cx={c.x} cy={c.y} r="3" fill="currentColor" />
                ))}
              </svg>
              <p className="text-xs text-gray-400 mt-1">
                {pontos.length} medida(s) · {min.toFixed(1)} – {max.toFixed(1)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
