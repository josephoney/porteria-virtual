import {
  NODE_TYPE_OTHER,
  nodeTypeLabel,
  nodeTypeOptionsForLevel,
  normalizeNodeType,
} from '@porteria/shared';

export { nodeTypeLabel, nodeTypeOptionsForLevel, normalizeNodeType };

/**
 * Etiquetas del enum legado, que sigue usando la página de Secciones y su
 * endpoint `/api/sections`. El árbol y el alta nueva usan
 * `nodeTypeOptionsForLevel`, con los catálogos por nivel.
 */
export const SECTION_TYPE_LABELS: Record<string, string> = {
  tower: 'Torre',
  interior: 'Interior',
  building: 'Edificio',
  zone: 'Zona',
  block: 'Bloque',
  sector: 'Sector',
  floor: 'Piso',
  house: 'Casa',
  lot: 'Lote',
  commercial: 'Comercial',
  common_area: 'Zona común',
  other: 'Otro',
};

/** Etiqueta visible, con respaldo en el legado y en "Otro". */
export function sectionTypeLabel(type?: string | null, customLabel?: string | null): string {
  return nodeTypeLabel(type, customLabel);
}

/**
 * Sugiere el tipo del nivel 1 a partir del nombre configurado, para no obligar a
 * elegirlo dos veces. Devuelve un identificador del catálogo actual.
 */
export function defaultSectionTypeForLevelName(levelName?: string | null): string {
  const normalized = (levelName ?? '').trim().toLowerCase();
  const aliases: Record<string, string> = {
    torre: 'torre',
    tower: 'torre',
    piso: 'piso',
    floor: 'piso',
    casa: 'casa',
    house: 'casa',
    bloque: 'bloque',
    block: 'bloque',
    lote: 'lote',
    lot: 'lote',
    edificio: 'edificio',
    building: 'edificio',
    manzana: 'manzana',
    ala: 'ala',
    zona: 'zona',
    sector: 'sector',
    modulo: 'modulo',
    'módulo': 'modulo',
    pabellon: 'pabellon',
    'pabellón': 'pabellon',
    nucleo: 'nucleo',
    'núcleo': 'nucleo',
    etapa: 'etapa',
    villa: 'villa',
    interior: 'interior',
  };

  return aliases[normalized] ?? NODE_TYPE_OTHER;
}
