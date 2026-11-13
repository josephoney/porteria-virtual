/**
 * The barcode on the back of a Colombian ID card carries the whole registry
 * record, not the document number alone, so the payload can never be compared
 * against what the resident typed.
 *
 * On the yellow card the document sits right after a run of padding zeros. A real
 * sample, with the owner's number confirmed, looks like this:
 *
 *   0204383011500295 56571441111253 000 80136371 01982103...
 *                                    └─┘└──────┘
 *                                     │  document
 *                                     └── padding
 *
 * Lengths vary between generations of the card, so the offsets after the padding
 * are tried in order and the rest are offered as alternatives. The guard confirms
 * against the physical card; nothing is authorized from the guess.
 */
const MIN_DOCUMENT_LENGTH = 6;

function looksLikeDate(value: string) {
  if (value.length !== 8) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** Candidate document numbers, ordered from most to least likely. */
export function documentCandidates(payload: string): string[] {
  const digits = payload.replace(/\D/g, '');
  if (!digits) return [];

  const found: string[] = [];
  const add = (raw: string) => {
    const value = raw.replace(/^0+/, '');
    if (value.length < MIN_DOCUMENT_LENGTH) return;
    if (looksLikeDate(value)) return;
    if (found.includes(value)) return;
    found.push(value);
  };

  const padding = /0{3,}/g;
  let match: RegExpExecArray | null;
  while ((match = padding.exec(digits)) !== null && found.length < 4) {
    const start = match.index + match[0].length;
    for (const size of [8, 9, 10] as const) {
      if (found.length >= 4) break;
      if (start + size <= digits.length) add(digits.slice(start, start + size));
    }
  }

  // Cards that do not pad: fall back to the plausible windows.
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
