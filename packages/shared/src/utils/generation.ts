/**
 * Planificador de generación de nodos de estructura.
 *
 * Es una función pura: recibe los parámetros y el nivel donde se ancla la
 * generación, y devuelve los nombres y la jerarquía que se crearían. El cliente
 * la usa para la vista previa y el servidor para ejecutar exactamente el mismo
 * plan. No conoce la base de datos ni detecta duplicados: eso lo valida el API.
 */

export type GenerationMode = 'sequential' | 'floors';

export type GenerationErrorCode =
  | 'invalid_params'
  | 'mode_not_applicable'
  | 'limit_exceeded'
  | 'branch_level_exceeded';

export interface GenerationParams {
  mode: GenerationMode;
  /** Modo secuencial. */
  count?: number;
  prefix?: string;
  suffix?: string;
  start?: number;
  padding?: number;
  /** Modo por pisos. */
  floors?: number;
  perFloor?: number;
  floorPrefix?: string;
  unitPrefix?: string;
  unitPadding?: number;
  startFloor?: number;
  unitStart?: number;
}

export interface PlannedNode {
  levelPosition: number;
  name: string;
  /** `null` cuelga del padre de la petición; un número es el índice en `nodes`. */
  parentIndex: number | null;
  nodeType: string | null;
}

export type GenerationPlan =
  | {
      ok: true;
      nodes: PlannedNode[];
      total: number;
      mode: GenerationMode;
    }
  | { ok: false; code: GenerationErrorCode; message: string };

export const GENERATION_LIMITS = {
  maxNodes: 300,
  maxFloors: 50,
  maxPerFloor: 50,
  maxSequential: 300,
} as const;

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function pad(value: number, width?: number): string {
  const size = width && width > 0 ? width : 0;
  return String(value).padStart(size, '0');
}

function joinName(prefix: string | undefined, value: string): string {
  const clean = (prefix ?? '').trim();
  return clean ? `${clean} ${value}` : value;
}

/**
 * Planifica la generación.
 *
 * `anchorLevel` es el nivel donde se crean los nodos y `leafLevel` el último de
 * la rama. Secuencial solo aplica en el nivel hoja; por pisos exige exactamente
 * dos niveles libres (pisos y unidades).
 */
export function planNodeGeneration(input: {
  params: GenerationParams;
  anchorLevel: number;
  leafLevel: number;
  nodeType?: string | null;
  unitType?: string | null;
}): GenerationPlan {
  const { params, anchorLevel, leafLevel } = input;

  if (anchorLevel > leafLevel) {
    return {
      ok: false,
      code: 'branch_level_exceeded',
      message: 'La rama no usa este nivel.',
    };
  }

  if (params.mode === 'sequential') {
    if (anchorLevel !== leafLevel) {
      return {
        ok: false,
        code: 'mode_not_applicable',
        message: 'La generación secuencial solo aplica al nivel hoja de la rama.',
      };
    }

    const count = params.count ?? 0;
    if (!isPositiveInt(count)) {
      return { ok: false, code: 'invalid_params', message: 'Indica cuántas unidades crear.' };
    }
    if (count > GENERATION_LIMITS.maxSequential) {
      return {
        ok: false,
        code: 'limit_exceeded',
        message: `El máximo es ${GENERATION_LIMITS.maxSequential} unidades por vez.`,
      };
    }

    const start = params.start ?? 1;
    if (!Number.isInteger(start) || start < 0) {
      return { ok: false, code: 'invalid_params', message: 'El número inicial no es válido.' };
    }

    const padding = params.padding ?? 0;
    if (!Number.isInteger(padding) || padding < 0 || padding > 6) {
      return { ok: false, code: 'invalid_params', message: 'El relleno debe estar entre 0 y 6.' };
    }

    const suffix = params.suffix?.trim() ?? '';
    const nodes: PlannedNode[] = [];
    for (let index = 0; index < count; index += 1) {
      const name = `${joinName(params.prefix, pad(start + index, padding))}${suffix}`;
      nodes.push({
        levelPosition: anchorLevel,
        name,
        parentIndex: null,
        nodeType: input.nodeType ?? null,
      });
    }

    return { ok: true, nodes, total: nodes.length, mode: 'sequential' };
  }

  // Modo por pisos: los pisos van en el nivel ancla y las unidades un nivel
  // más abajo, que debe ser la hoja de la rama.
  if (leafLevel - anchorLevel !== 1) {
    return {
      ok: false,
      code: 'mode_not_applicable',
      message: 'El modo por pisos necesita un nivel de pisos y otro de unidades.',
    };
  }

  const floors = params.floors ?? 0;
  const perFloor = params.perFloor ?? 0;
  if (!isPositiveInt(floors) || !isPositiveInt(perFloor)) {
    return {
      ok: false,
      code: 'invalid_params',
      message: 'Indica la cantidad de pisos y de unidades por piso.',
    };
  }
  if (floors > GENERATION_LIMITS.maxFloors) {
    return {
      ok: false,
      code: 'limit_exceeded',
      message: `El máximo es ${GENERATION_LIMITS.maxFloors} pisos por vez.`,
    };
  }
  if (perFloor > GENERATION_LIMITS.maxPerFloor) {
    return {
      ok: false,
      code: 'limit_exceeded',
      message: `El máximo es ${GENERATION_LIMITS.maxPerFloor} unidades por piso.`,
    };
  }

  const total = floors + floors * perFloor;
  if (total > GENERATION_LIMITS.maxNodes) {
    return {
      ok: false,
      code: 'limit_exceeded',
      message: `El máximo es ${GENERATION_LIMITS.maxNodes} elementos por vez.`,
    };
  }

  const startFloor = params.startFloor ?? 1;
  const unitStart = params.unitStart ?? 1;
  if (!Number.isInteger(startFloor) || startFloor < 0 || !Number.isInteger(unitStart) || unitStart < 0) {
    return { ok: false, code: 'invalid_params', message: 'La numeración inicial no es válida.' };
  }

  const unitPadding = params.unitPadding ?? 2;
  if (!Number.isInteger(unitPadding) || unitPadding < 1 || unitPadding > 4) {
    return { ok: false, code: 'invalid_params', message: 'El relleno de unidad debe estar entre 1 y 4.' };
  }

  const nodes: PlannedNode[] = [];
  const floorPrefix = params.floorPrefix ?? 'Piso';
  const unitPrefix = params.unitPrefix ?? '';

  for (let floorIndex = 0; floorIndex < floors; floorIndex += 1) {
    const floorNumber = startFloor + floorIndex;
    const floorNode: PlannedNode = {
      levelPosition: anchorLevel,
      name: joinName(floorPrefix, pad(floorNumber, 0)),
      parentIndex: null,
      nodeType: input.nodeType ?? null,
    };
    const floorNodeIndex = nodes.length;
    nodes.push(floorNode);

    for (let unitIndex = 0; unitIndex < perFloor; unitIndex += 1) {
      const unitNumber = `${floorNumber}${pad(unitStart + unitIndex, unitPadding)}`;
      nodes.push({
        levelPosition: anchorLevel + 1,
        name: `${unitPrefix}${unitNumber}`,
        parentIndex: floorNodeIndex,
        nodeType: input.unitType ?? null,
      });
    }
  }

  return { ok: true, nodes, total: nodes.length, mode: 'floors' };
}
