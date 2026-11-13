/**
 * The barcode on the back of a Colombian ID card carries the whole registry
 * record, not the document number alone, so the payload can never be compared
 * against what the resident typed.
 *
 * A real sample starts like this:
 *
 *   020438301150A         02...
 *   └┘└────────┘
 *    │      └── document, padded to ten digits
 *    └── two digit record type
 *
 * The document is the ten digit field after the prefix, with the zero padding
 * removed. If a card ever disagrees, the caller shows the guess in an editable
 * field, so the guard fixes it instead of hitting a wall.
 */
const RECORD_PREFIX_LENGTH = 2;
const DOCUMENT_FIELD_LENGTH = 10;
const MIN_DOCUMENT_LENGTH = 6;

function looksLikeDate(value: string) {
  if (value.length !== 8) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** Extracts the document number from a scanned ID payload, or an empty string. */
export function documentFromBarcode(payload: string): string {
  const digits = payload.replace(/\D/g, '');
  if (!digits) return '';

  // Documented layout: type prefix, then the document padded to ten digits.
  if (digits.length >= RECORD_PREFIX_LENGTH + MIN_DOCUMENT_LENGTH) {
    const field = digits.slice(RECORD_PREFIX_LENGTH, RECORD_PREFIX_LENGTH + DOCUMENT_FIELD_LENGTH);
    const document = field.replace(/^0+/, '');
    if (document.length >= MIN_DOCUMENT_LENGTH) return document;
  }

  // Fallback for a card that does not follow the layout: first plausible window.
  for (const size of [10, 9, 8, 7, 6] as const) {
    for (let start = 0; start + size <= digits.length; start += 1) {
      const window = digits.slice(start, start + size);
      if (looksLikeDate(window)) continue;
      const document = window.replace(/^0+/, '');
      if (document.length >= MIN_DOCUMENT_LENGTH) return document;
    }
  }

  return '';
}

/** Kept for the guard: shows the raw shape while a card format is being checked. */
export function describeBarcode(payload: string) {
  const digits = payload.replace(/\D/g, '');
  return {
    length: payload.length,
    digits: digits.length,
    head: payload.slice(0, 24),
    digitsAll: digits,
  };
}

/**
 * Candidate document numbers from the scanned payload.
 *
 * The field boundaries vary between generations of the yellow card, so instead of
 * betting on one offset the app offers the plausible readings and the guard picks
 * the one printed on the card he is holding. Ordered from most to least likely.
 */
export function documentCandidates(payload: string): string[] {
  const digits = payload.replace(/\D/g, '');
  if (!digits) return [];

  const seen = new Set<string>();
  const candidates: string[] = [];
  const offsets = [2, 4, 0, 6, 3, 1];

  for (const size of [10, 9, 8] as const) {
    for (const offset of offsets) {
      if (offset + size > digits.length) continue;
      const window = digits.slice(offset, offset + size);
      if (looksLikeDate(window)) continue;
      const value = window.replace(/^0+/, '');
      if (value.length < MIN_DOCUMENT_LENGTH) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      candidates.push(value);
      if (candidates.length >= 4) return candidates;
    }
  }

  return candidates;
}