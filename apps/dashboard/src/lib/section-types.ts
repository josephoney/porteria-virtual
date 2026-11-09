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
  other: 'Otro',
};

export function sectionTypeLabel(type?: string | null, customLabel?: string | null): string {
  if (type === 'other') return customLabel || 'Otro';
  if (!type) return 'Sin tipo';
  return SECTION_TYPE_LABELS[type] ?? type;
}
