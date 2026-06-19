import type { ZoneBandDef } from './types';

/** Faixas PHQ-9 (APA / Kroenke). */
export const PHQ9_ZONES: ZoneBandDef[] = [
  { min: 0, max: 4, label: 'Mínimo', color: '#dcfce7' },
  { min: 5, max: 9, label: 'Leve', color: '#fef9c3' },
  { min: 10, max: 14, label: 'Moderado', color: '#fed7aa' },
  { min: 15, max: 19, label: 'Moderadamente grave', color: '#fecaca' },
  { min: 20, max: 27, label: 'Grave', color: '#fca5a5' },
];

/** Faixas GAD-7. */
export const GAD7_ZONES: ZoneBandDef[] = [
  { min: 0, max: 4, label: 'Mínimo', color: '#dcfce7' },
  { min: 5, max: 9, label: 'Leve', color: '#fef9c3' },
  { min: 10, max: 14, label: 'Moderado', color: '#fed7aa' },
  { min: 15, max: 21, label: 'Grave', color: '#fca5a5' },
];

/** PASI — zonas clínicas simplificadas (EADV). */
export const PASI_ZONES: ZoneBandDef[] = [
  { min: 0, max: 3, label: 'Remissão / leve', color: '#dcfce7' },
  { min: 3, max: 10, label: 'Moderado', color: '#fef9c3' },
  { min: 10, max: 20, label: 'Grave', color: '#fed7aa' },
  { min: 20, max: 72, label: 'Muito grave', color: '#fca5a5' },
];

/** SCORAD — atópica. */
export const SCORAD_ZONES: ZoneBandDef[] = [
  { min: 0, max: 25, label: 'Leve', color: '#dcfce7' },
  { min: 25, max: 50, label: 'Moderado', color: '#fef9c3' },
  { min: 50, max: 103, label: 'Grave', color: '#fca5a5' },
];

/** EVA dor 0–10. */
export const EVA_ZONES: ZoneBandDef[] = [
  { min: 0, max: 3, label: 'Leve', color: '#dcfce7' },
  { min: 4, max: 6, label: 'Moderada', color: '#fef9c3' },
  { min: 7, max: 10, label: 'Intensa', color: '#fca5a5' },
];

/** DLQI 0–30. */
export const DLQI_ZONES: ZoneBandDef[] = [
  { min: 0, max: 1, label: 'Sem efeito', color: '#dcfce7' },
  { min: 2, max: 5, label: 'Pequeno', color: '#fef9c3' },
  { min: 6, max: 10, label: 'Moderado', color: '#fed7aa' },
  { min: 11, max: 30, label: 'Grande / muito grande', color: '#fca5a5' },
];
