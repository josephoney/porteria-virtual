import { geographySchema } from '../schemas/index.js';

export interface GeographyValues {
  municipality: string | null;
  department: string | null;
  country: string | null;
}

interface GeographyInput {
  municipality?: unknown;
  department?: unknown;
  country?: unknown;
}

function normalize(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Valida y normaliza los campos geográficos de un alta.
 * Devuelve `null` cuando algún campo supera la longitud permitida.
 */
export function parseGeographyCreate(body: GeographyInput): GeographyValues | null {
  const parsed = geographySchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    municipality: normalize(parsed.data.municipality),
    department: normalize(parsed.data.department),
    country: normalize(parsed.data.country),
  };
}

/**
 * Valida y normaliza los campos geográficos de un update parcial.
 * Solo devuelve las claves presentes en el body, para no pisar datos existentes.
 * Devuelve `null` cuando algún campo supera la longitud permitida.
 */
export function parseGeographyPatch(body: GeographyInput): Partial<GeographyValues> | null {
  const parsed = geographySchema.safeParse(body);
  if (!parsed.success) return null;
  const values: Partial<GeographyValues> = {};
  if (body.municipality !== undefined) values.municipality = normalize(parsed.data.municipality);
  if (body.department !== undefined) values.department = normalize(parsed.data.department);
  if (body.country !== undefined) values.country = normalize(parsed.data.country);
  return values;
}
