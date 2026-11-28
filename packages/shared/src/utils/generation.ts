/**
 * Planificador de generación por niveles.
 *
 * El ayudante crea varios elementos de forma secuencial en cada nivel por
 * debajo del formulario: 5 sectores, y dentro de cada sector 6 casas, y dentro
 * de cada casa 5 cuartos. Cada nivel decide su cantidad, su prefijo y si numera
 * con números o con letras.
 *
 * Es una función pura: el cliente la usa para la vista previa y el servidor para
 * ejecutar el mismo plan. No conoce la base de datos; los nombres duplicados los
 * valida el API.
 */

export type GenerationErrorCode =
  | 'invalid_params'
  | 'limit_exceeded'
  | 'branch_level_exceeded';

export type GenerationSequence = 'numbers' | 'letters';

export interface GenerationLevelSpec {
  /** El primer nivel siempre se crea; los siguientes son opcionales. */
  enabled?: boolean;
  /** Cuántos elementos de este nivel por cada padre. */
  count: number;
  /** Prefijo del nombre. Si falta, usa el nombre del nivel. */
  prefix?: string;
  sequence?: GenerationSequence;
  /** Número inicial (solo números) o índice inicial (solo letras). */
  start?: number;
  /** Cantidad de ceros a la izquierda. */
  padding?: number;
  /**
   * Este nivel usa el nombre compuesto de la plantilla. Permite simplificar
   * solo algunos niveles y dejar los demás con su prefijo y su número.
   */
  simplified?: boolean;
}

export interface PlannedNode {
  levelPosition: number;
  name: string;
  /** `null` cuelga del padre de la petición; un número es el índice en `nodes`. */
  parentIndex: number | null;
  nodeType: string | null;
  /** Código simplificado; solo cuando se pide simplificar. */
  code: string | null;
}

export type GenerationPlan =
  | {
      ok: true;
      nodes: PlannedNode[];
      total: number;
      template: string | null;
    }
  | { ok: false; code: GenerationErrorCode; message: string };

export const GENERATION_LIMITS = {
  maxNodes: 300,
  maxPerLevel: 100,
} as const;

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** A, B, … Z, AA, AB… */
function letterAt(index: number): string {
  let value = index;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result || 'A';
}

/**
 * Formatea el valor de la secuencia.
 *
 * `padding` es la **cantidad de ceros a la izquierda**: 0 deja `1, 2, … 10, 11`;
 * 1 produce `01, 02, …`; 2 produce `001, 002, …`.
 */
function sequenceLabel(spec: GenerationLevelSpec, index: number): string {
  const start = Number.isInteger(spec.start) && (spec.start ?? 0) > 0 ? (spec.start as number) : 1;
  if (spec.sequence === 'letters') return letterAt(start + index);
  const value = start + index;
  const padding = Number.isInteger(spec.padding) && (spec.padding ?? 0) > 0 ? (spec.padding as number) : 0;
  return String(value).padStart(padding + 1, '0');
}

/** Plantilla por defecto: `{1}-{2}{3}` para tres niveles. */
export function defaultSimplifiedTemplate(levelCount: number): string {
  if (levelCount <= 1) return '{1}';
  if (levelCount === 2) return '{1}-{2}';
  const rest = Array.from({ length: levelCount - 1 }, (_, index) => `{${index + 2}}`).join('');
  return `{1}-${rest}`;
}

/**
 * Reemplaza los tokens de la plantilla.
 *
 * `{1}`..`{3}` son los segmentos de la ruta y `{p1}`..`{p3}` los prefijos de
 * cada nivel. Los separadores finales se recortan, para que un nivel que todavía
 * no tiene hijos no quede como `Albatroz 1-`.
 */
function applyTemplate(template: string, path: string[], prefixes: string[]): string {
  const replaced = template.replace(
    /\{(p?)(\d)\}/g,
    (_match, prefixToken: string, position: string) => {
      const index = Number(position) - 1;
      return prefixToken ? (prefixes[index] ?? '') : (path[index] ?? '');
    },
  );

  return replaced
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .trim();
}

/**
 * Planifica la creación.
 *
 * `anchorLevel` es el nivel del formulario y `leafLevel` el último de la rama:
 * no se puede planificar más allá de la hoja. Los niveles deben ser contiguos:
 * si se habilita el tercero, el segundo también.
 */
export function planNestedGeneration(input: {
  anchorLevel: number;
  leafLevel: number;
  levels: GenerationLevelSpec[];
  levelNames: string[];
  simplified?: boolean;
  template?: string;
  nodeType?: string | null;
}): GenerationPlan {
  const { anchorLevel, leafLevel, levels } = input;

  if (anchorLevel > leafLevel) {
    return { ok: false, code: 'branch_level_exceeded', message: 'La rama no usa este nivel.' };
  }

  const available = leafLevel - anchorLevel + 1;
  if (levels.length === 0) {
    return { ok: false, code: 'invalid_params', message: 'Indica cuántos elementos crear.' };
  }
  if (levels.length > available) {
    return {
      ok: false,
      code: 'invalid_params',
      message: `La rama solo admite ${available} nivel${available === 1 ? '' : 'es'} desde aquí.`,
    };
  }

  // Los niveles deben ser contiguos desde el ancla.
  let enabledCount = 0;
  for (const level of levels) {
    if (level.enabled === false) break;
    enabledCount += 1;
  }
  if (enabledCount === 0) {
    return { ok: false, code: 'invalid_params', message: 'Indica cuántos elementos crear.' };
  }
  for (const level of levels.slice(0, enabledCount)) {
    if (!isPositiveInt(level.count)) {
      return {
        ok: false,
        code: 'invalid_params',
        message: 'Cada nivel habilitado necesita una cantidad mayor que cero.',
      };
    }
    if (level.count > GENERATION_LIMITS.maxPerLevel) {
      return {
        ok: false,
        code: 'limit_exceeded',
        message: `El máximo por nivel es ${GENERATION_LIMITS.maxPerLevel}.`,
      };
    }
  }

  const total = levels
    .slice(0, enabledCount)
    .reduce((accumulator, level) => accumulator * level.count, 1);
  if (total > GENERATION_LIMITS.maxNodes) {
    return {
      ok: false,
      code: 'limit_exceeded',
      message: `El máximo es ${GENERATION_LIMITS.maxNodes} elementos por vez.`,
    };
  }

  const template = input.template?.trim() || defaultSimplifiedTemplate(enabledCount);

  // Prefijos por nivel, para los tokens `{p1}`, `{p2}` y `{p3}`.
  const prefixes = levels.map((spec, index) => {
    const position = anchorLevel + index;
    const levelName = input.levelNames[position - 1] ?? `Nivel ${position}`;
    return (spec.prefix ?? levelName).trim();
  });

  const anySimplified = levels
    .slice(0, enabledCount)
    .some(
      (spec) => spec.simplified === true || (input.simplified === true && spec.simplified !== false),
    );

  const nodes: PlannedNode[] = [];
  let frontier: { index: number | null; path: string[] }[] = [{ index: null, path: [] }];

  for (let levelIndex = 0; levelIndex < enabledCount; levelIndex += 1) {
    const spec = levels[levelIndex];
    const levelPosition = anchorLevel + levelIndex;
    const levelName = input.levelNames[levelPosition - 1] ?? `Nivel ${levelPosition}`;
    const nextFrontier: { index: number; path: string[] }[] = [];
    const simplifyThis =
      spec.simplified === true || (input.simplified === true && spec.simplified !== false);

    for (const parent of frontier) {
      for (let elementIndex = 0; elementIndex < spec.count; elementIndex += 1) {
        const segment = sequenceLabel(spec, elementIndex);
        const path = [...parent.path, segment];
        const prefix = (spec.prefix ?? levelName).trim();
        const name = simplifyThis
          ? applyTemplate(template, path, prefixes)
          : prefix
            ? `${prefix} ${segment}`
            : segment;

        const nodeIndex = nodes.length;
        nodes.push({
          levelPosition,
          name,
          parentIndex: parent.index,
          nodeType: input.nodeType ?? null,
          code: simplifyThis ? name : null,
        });
        nextFrontier.push({ index: nodeIndex, path });
      }
    }

    frontier = nextFrontier;
  }

  return {
    ok: true,
    nodes,
    total: nodes.length,
    template: anySimplified ? template : null,
  };
}
