/**
 * The barcode on the back of a Colombian ID card does not contain the document
 * number alone: it carries the whole registry record — dates, names, paddings,
 * sometimes as one long run of digits. Comparing that payload against the number
 * the resident typed can never match, so the number has to be pulled out of it.
 *
 * The record starts with a `PubDSK_1` prefix followed by padding and the number.
 * Since the padding varies between batches of cards, this reads the digit string
 * and picks the first window that looks like a document: no leading zero, and not
 * a date. The caller shows the guess in an editable field, so a wrong pick costs
 * the guard a correction, not a failed check.
 */
const DOCUMENT_LENGTHS = [10, 9, 8, 7, 6] as const;

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

  for (const size of DOCUMENT_LENGTHS) {
    for (let start = 0; start + size <= digits.length; start += 1) {
      const window = digits.slice(start, start + size);
      if (window.startsWith('0')) continue;
      if (looksLikeDate(window)) continue;
      return window;
    }
  }

  return '';
}

/** Kept for the guard: shows the raw payload while the format is being tuned. */
export function describeBarcode(payload: string) {
  const digits = payload.replace(/\D/g, '');
  return { length: payload.length, digits: digits.length, head: payload.slice(0, 24) };
}
