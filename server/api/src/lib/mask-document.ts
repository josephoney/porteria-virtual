/**
 * Leaves the last four characters of a document and hides the rest.
 *
 * The last four are enough for a person to recognise their own document and for
 * staff to confirm they are looking at the right record, and not enough to
 * reconstruct the identifier. Used everywhere the document is shown after the
 * moment it was needed.
 */
export function maskDocument(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '***';
  return `***${trimmed.slice(-4)}`;
}
