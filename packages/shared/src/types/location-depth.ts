/**
 * Profundidad de una rama de la estructura.
 *
 * La estructura define el máximo (1 a 3). Cada rama puede terminar antes: el
 * hotel usa los tres niveles y una torre de apartamentos solo dos. La hoja se
 * decide por rama, no por el máximo de la comunidad.
 */

export const MAX_BRANCH_LEVELS = 3;

/** Nivel en el que termina la rama: el suyo si lo declara, o el máximo. */
export function resolveLeafLevel(
  branchLevelCount: number | null | undefined,
  structureLevelCount: number,
): number {
  if (!branchLevelCount || branchLevelCount < 1) return structureLevelCount;
  return Math.min(branchLevelCount, structureLevelCount);
}

/** ¿Este nivel es la hoja de su rama? */
export function isLeafAt(
  levelPosition: number,
  branchLevelCount: number | null | undefined,
  structureLevelCount: number,
): boolean {
  return levelPosition === resolveLeafLevel(branchLevelCount, structureLevelCount);
}

/** ¿La rama admite hijos en este nivel? */
export function canHaveChildren(
  levelPosition: number,
  branchLevelCount: number | null | undefined,
  structureLevelCount: number,
): boolean {
  return levelPosition < resolveLeafLevel(branchLevelCount, structureLevelCount);
}
