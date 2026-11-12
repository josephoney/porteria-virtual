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

export function sectionTypeLabel(type?: string | null, customLabel?: string | null): string {
  if (type === 'other') return customLabel || 'Otro';
  if (!type) return 'Sin tipo';
  return SECTION_TYPE_LABELS[type] ?? type;
}

/**
 * Suggests the section type from the name the admin gave to the first level,
 * so a structure called "Torre" does not require picking "Torre" again.
 */
export function defaultSectionTypeForLevelName(levelName?: string | null): string {
  const normalized = (levelName ?? '').trim().toLowerCase();
  const rules: Array<[string[], string]> = [
    [['torre', 'tower'], 'tower'],
    [['piso', 'floor'], 'floor'],
    [['casa', 'house'], 'house'],
    [['bloque', 'block'], 'block'],
    [['lote', 'lot'], 'lot'],
  ];

  for (const [prefixes, type] of rules) {
    if (prefixes.some((prefix) => normalized.startsWith(prefix))) return type;
  }
  return 'other';
}
