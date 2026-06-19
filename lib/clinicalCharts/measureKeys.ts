/** Rótulos e chaves numéricas do prontuário (fonte única). */
export const CLINICAL_MEASURE_LABELS: Record<string, string> = {
  peso_kg: 'Peso (kg)',
  altura_cm: 'Altura (cm)',
  imc: 'IMC (kg/m²)',
  perimetro_cefalico: 'Perímetro cefálico (cm)',
  pa_sistolica: 'PA sistólica (mmHg)',
  pa_diastolica: 'PA diastólica (mmHg)',
  glicemia: 'Glicemia (mg/dL)',
  hba1c: 'HbA1c (%)',
  ldl: 'LDL (mg/dL)',
  hdl: 'HDL (mg/dL)',
  triglicerides: 'Triglicerídeos (mg/dL)',
  creatinina: 'Creatinina (mg/dL)',
  tfg: 'TFG (mL/min)',
  freq_cardiaca: 'FC (bpm)',
  temperatura: 'Temperatura (°C)',
  saturacao: 'SpO₂ (%)',
  fev1: 'FEV1 (L)',
  cvf: 'CVF (L)',
  vef1_cvf: 'VEF1/CVF',
  cea: 'CEA (ng/mL)',
  ca125: 'CA-125 (U/mL)',
  psa: 'PSA (ng/mL)',
  afp: 'AFP (ng/mL)',
  ca19_9: 'CA 19-9 (U/mL)',
  ldh: 'LDH (U/L)',
  sumatorio_lesoes_mm: 'Soma lesões-alvo (mm)',
  carga_tumoral_pct: 'Carga tumoral (% vs basal)',
  pasi: 'PASI',
  scorad: 'SCORAD',
  dlqi: 'DLQI',
  phq9: 'PHQ-9',
  gad7: 'GAD-7',
  eva_dor: 'EVA dor (0–10)',
  ig_semanas: 'IG (semanas)',
  altura_uterina_cm: 'Altura uterina (cm)',
};

export const CHART_NUMERIC_KEYS = new Set(Object.keys(CLINICAL_MEASURE_LABELS));

export function measureLabel(key: string): string {
  return CLINICAL_MEASURE_LABELS[key] ?? key.replace(/_/g, ' ');
}
