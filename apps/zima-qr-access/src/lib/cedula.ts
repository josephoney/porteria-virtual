/**
 * The barcode on the back of a Colombian ID card carries the whole registry
 * record, not the document number alone, so the payload can never be compared
 * against what the resident typed.
 *
 * Two real samples, with their numbers confirmed:
 *
 *   Yellow card, 10 digits. After the `PubDSK_1` prefix comes a long digit run
 *   and then the surnames, so the document is the tail of that run:
 *
 *     PubDSK_1 ... 850801501141526205 ... PEDRAZA GUTIERREZ JUAN MIGUEL
 *                      └────────────┘
 *                        └────────┬──┘
 *                         1141526205
 *
 *   Yellow card, 8 digits. No prefix, and the document sits after padding zeros:
 *
 *     0204383011500295...1253 000 80136371 01982103...
 *                              └─┘└──────┘
 *
 * Lengths vary between generations, so the readings are ordered by confidence and
 * the rest are offered as alternatives. The guard confirms against the physical
 * card; nothing is authorized from the guess.
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
 * Cards with the `PubDSK` prefix put the document at the end of the digit run
 * that sits right before the surnames. Reading from the surnames backwards is
 * safer than counting offsets from the prefix, which changes between batches.
 */
function documentBeforeSurnames(payload: string): string | null {
  const marker = /PubDSK_?1?/i.exec(payload);
  if (!marker) return null;

  const rest = payload.slice(marker.index + marker[0].length);
  const letters = /[A-Za-zÁÉÍÓÚÑÜ]{4,}/.exec(rest);
  if (!letters) return null;

  let end = letters.index - 1;
  while (end >= 0 && !/\d/.test(rest[end])) end -= 1;
  if (end < 0) return null;

  let start = end;
  while (start >= 0 && /\d/.test(rest[start])) start -= 1;

  const run = rest.slice(start + 1, end + 1);
  if (run.length < 8) return null;

  return run.slice(-MAX_DOCUMENT_LENGTH);
}

/** Candidate document numbers, ordered from most to least likely. */
export function documentCandidates(payload: string): string[] {
  const found: string[] = [];
  const add = (raw: string | null) => {
    if (!raw) return;
    const value = raw.replace(/^0+/, '');
    if (value.length < MIN_DOCUMENT_LENGTH) return;
    if (looksLikeDate(value)) return;
    if (found.includes(value)) return;
    found.push(value);
  };

  const beforeSurnames = documentBeforeSurnames(payload);
  add(beforeSurnames);
  if (beforeSurnames && beforeSurnames.length > 8) add(beforeSurnames.slice(0, 8));

  const digits = payload.replace(/\D/g, '');

  const padding = /0{3,}/g;
  let match: RegExpExecArray | null;
  while ((match = padding.exec(digits)) !== null && found.length < 5) {
    const start = match.index + match[0].length;
    for (const size of [8, 9, 10] as const) {
      if (found.length >= 5) break;
      if (start + size <= digits.length) add(digits.slice(start, start + size));
    }
  }

  // Cards that follow neither pattern: try the plausible windows.
  for (const size of [10, 9, 8] as const) {
    for (let start = 0; start + size <= digits.length && found.length < 6; start += 1) {
      add(digits.slice(start, start + size));
    }
  }

  return found;
}

/** The reading the app prefills. */
export function documentFromBarcode(payload: string): string {
  return documentCandidates(payload)[0] ?? '';
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
