/**
 * Catálogos de tipo de nodo por nivel.
 *
 * El nivel 1 describe contenedores (torre, edificio, zona) y los niveles 2 y 3
 * describen espacios (apartamento, oficina, habitación). Son arreglos y no un
 * enum de base de datos: agregar un tipo no debe exigir una migración.
 */

export interface NodeTypeOption {
  id: string;
  label: string;
}

export const NODE_TYPE_OTHER = 'other';

/** Contenedores del nivel 1, en orden alfabético por etiqueta. */
export const LEVEL_1_NODE_TYPES: NodeTypeOption[] = [
  { id: 'ala', label: 'Ala' },
  { id: 'bloque', label: 'Bloque' },
  { id: 'edificio', label: 'Edificio' },
  { id: 'etapa', label: 'Etapa' },
  { id: 'interior', label: 'Interior' },
  { id: 'manzana', label: 'Manzana' },
  { id: 'modulo', label: 'Módulo' },
  { id: 'nucleo', label: 'Núcleo' },
  { id: 'pabellon', label: 'Pabellón' },
  { id: 'piso', label: 'Piso' },
  { id: 'sector', label: 'Sector' },
  { id: 'torre', label: 'Torre' },
  { id: 'unidad', label: 'Unidad' },
  { id: 'villa', label: 'Villa' },
  { id: 'zona', label: 'Zona' },
  { id: 'common_area', label: 'Zona común' },
  { id: NODE_TYPE_OTHER, label: 'Otro' },
];

/** Espacios de los niveles 2 y 3, en orden alfabético por etiqueta. */
export const LEVEL_2_NODE_TYPES: NodeTypeOption[] = [
  { id: 'apartamento', label: 'Apartamento' },
  { id: 'bodega', label: 'Bodega' },
  { id: 'casa', label: 'Casa' },
  { id: 'consultorio', label: 'Consultorio' },
  { id: 'cuarto_util', label: 'Cuarto útil' },
  { id: 'deposito', label: 'Depósito' },
  { id: 'habitacion', label: 'Habitación' },
  { id: 'local', label: 'Local' },
  { id: 'lote', label: 'Lote' },
  { id: 'oficina', label: 'Oficina' },
  { id: 'parqueadero', label: 'Parqueadero' },
  { id: 'suite', label: 'Suite' },
  { id: 'terraza', label: 'Terraza' },
  { id: 'unidad', label: 'Unidad' },
  { id: NODE_TYPE_OTHER, label: 'Otro' },
];

/** Etiquetas del enum legado que ya no están en los catálogos. */
const LEGACY_NODE_TYPE_LABELS: Record<string, string> = {
  tower: 'Torre',
  building: 'Edificio',
  block: 'Bloque',
  zone: 'Zona',
  sector: 'Sector',
  floor: 'Piso',
  interior: 'Interior',
  house: 'Casa',
  lot: 'Lote',
  commercial: 'Local comercial',
  common_area: 'Zona común',
};

/** Catálogo que corresponde a un nivel de la estructura. */
export function nodeTypeOptionsForLevel(levelPosition: number): NodeTypeOption[] {
  return levelPosition <= 1 ? LEVEL_1_NODE_TYPES : LEVEL_2_NODE_TYPES;
}

/** Etiqueta visible de un tipo, con respaldo en el legado y en "Otro". */
export function nodeTypeLabel(type?: string | null, customLabel?: string | null): string {
  if (!type) return 'Sin tipo';
  if (type === NODE_TYPE_OTHER) return customLabel?.trim() || 'Otro';

  const option =
    LEVEL_1_NODE_TYPES.find((item) => item.id === type) ??
    LEVEL_2_NODE_TYPES.find((item) => item.id === type);
  if (option) return option.label;

  return LEGACY_NODE_TYPE_LABELS[type] ?? type;
}

/** Alias del enum legado hacia los identificadores del catálogo. */
const LEGACY_ALIASES: Record<string, string> = {
  tower: 'torre',
  building: 'edificio',
  block: 'bloque',
  zone: 'zona',
  floor: 'piso',
  house: 'casa',
  lot: 'lote',
  commercial: 'local',
};

/** Convierte un identificador legado al del catálogo actual. */
export function normalizeNodeType(type: string): string {
  return LEGACY_ALIASES[type] ?? type;
}

/** ¿El identificador pertenece al catálogo del nivel? Acepta alias legados. */
export function isValidNodeType(type: string, levelPosition: number): boolean {
  const normalized = normalizeNodeType(type);
  return nodeTypeOptionsForLevel(levelPosition).some((option) => option.id === normalized);
}
