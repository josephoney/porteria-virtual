/**
 * The barcode on the back of a Colombian ID card carries the whole registry
 * record, not the document number alone, so the payload can never be compared
 * against what the resident typed.
 *
 * Both generations end the same way: the document is the tail of the digit run
 * that sits right before the surnames.
 *
 *   10 digits:  PubDSK_1 … 850801501141526205 … PEDRAZA GUTIERREZ JUAN
 *                             └───────┬──────┘
 *                               1141526205
 *
 *   8 digits:   020438301150A 02… 1111253 000 80136371 PEDRAZA CRUZ JOSE
 *                                            └──────┘
 *                                             80136371
 *
 * Reading backwards from the surnames is stable across batches of cards; counting
 * offsets from the prefix is not.
 */
const MIN_DOCUMENT_LENGTH = 6;
const MAX_DOCUMENT_LENGTH = 10;

function looksLikeDate(value: string) {
  if (value.length !== 8) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * Digits immediately before the first word of the record, taking the last ten and
 * dropping the zero padding.
 */
function documentBeforeSurnames(payload: string): string | null {
  // The `PubDSK` prefix is letters too: start after it when it is present.
  const marker = /PubDSK_?1?/i.exec(payload);
  const from = marker ? marker.index + marker[0].length : 0;
  const rest = payload.slice(from);

  const letters = /[A-Za-zÁÉÍÓÚÑÜ]{4,}/.exec(rest);
  if (!letters) return null;

  let end = letters.index - 1;
  while (end >= 0 && !/\d/.test(rest[end])) end -= 1;
  if (end < 0) return null;

  let start = end;
  while (start >= 0 && /\d/.test(rest[start])) start -= 1;

  const run = rest.slice(start + 1, end + 1);
  if (run.length < 8) return null;

  const value = run.slice(-MAX_DOCUMENT_LENGTH).replace(/^0+/, '');
  return value.length >= MIN_DOCUMENT_LENGTH ? value : null;
}

/** Fallback for a card whose record has no names: digits after padding zeros. */
function documentAfterPadding(digits: string): string | null {
  const padding = /0{3,}/g;
  let match: RegExpExecArray | null;
  while ((match = padding.exec(digits)) !== null) {
    const start = match.index + match[0].length;
    for (const size of [8, 9, 10] as const) {
      const candidate = digits.slice(start, start + size).replace(/^0+/, '');
      if (candidate.length >= MIN_DOCUMENT_LENGTH && !looksLikeDate(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/** The document number of the holder, or an empty string when it cannot be read. */
export function documentFromBarcode(payload: string): string {
  const fromNames = documentBeforeSurnames(payload);
  if (fromNames) return fromNames;

  return documentAfterPadding(payload.replace(/\D/g, '')) ?? '';
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
