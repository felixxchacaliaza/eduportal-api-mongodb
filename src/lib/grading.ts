/**
 * Reglas de evaluación MINEDU (Secundaria, escala vigesimal 0-20).
 * Única fuente de verdad del backend para calcular promedios.
 */

export const PASSING_GRADE = 11;

export const BIMESTER_FIELDS = ['bimester1', 'bimester2', 'bimester3', 'bimester4'] as const;
export type BimesterField = (typeof BIMESTER_FIELDS)[number];

export type BimesterValues = Record<BimesterField, number | null>;

/** Redondeo MINEDU: la fracción >= 0.5 sube al entero superior (10.5 -> 11). */
export function roundMinedu(value: number): number {
  return Math.floor(value + 0.5 + Number.EPSILON);
}

/**
 * Promedio anual de un área: media de los bimestres REGISTRADOS (los null no cuentan).
 * Devuelve 0 si todavía no hay ningún bimestre registrado.
 */
export function computeFinalAverage(b: BimesterValues): number {
  const registered = BIMESTER_FIELDS.map(k => b[k]).filter((v): v is number => v !== null && v !== undefined);
  if (registered.length === 0) return 0;
  return roundMinedu(registered.reduce((sum, v) => sum + v, 0) / registered.length);
}

/** true si el área tiene al menos un bimestre registrado. */
export function hasAnyBimester(b: BimesterValues): boolean {
  return BIMESTER_FIELDS.some(k => b[k] !== null && b[k] !== undefined);
}

/** Promedio general del alumno (1 decimal) usando solo las áreas que ya tienen alguna nota. */
export function studentAverage(grades: (BimesterValues & { finalAverage: number })[]): number {
  const evaluated = grades.filter(hasAnyBimester);
  if (evaluated.length === 0) return 0;
  const avg = evaluated.reduce((sum, g) => sum + g.finalAverage, 0) / evaluated.length;
  return Number(avg.toFixed(1));
}

/** Número de bimestre (1..4) a partir del nombre de campo. */
export function bimesterNumber(field: BimesterField): number {
  return BIMESTER_FIELDS.indexOf(field) + 1;
}

export const BIMESTER_LABELS = ['I', 'II', 'III', 'IV'];
