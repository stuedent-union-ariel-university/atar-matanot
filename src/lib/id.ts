// Shared handling of the Israeli ID number (PII): format check, normalization,
// and the optional check-digit test.

const ID_FORMAT = /^[0-9]{7,10}$/;

// Returns the trimmed ID, or null when the input isn't a 7-10 digit string.
export function normalizeUserId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return ID_FORMAT.test(id) ? id : null;
}

// Israeli ID check digit: left-pad to 9 digits, multiply digits by 1,2,1,2...,
// sum the digits of each product, and a valid number sums to a multiple of 10.
// IDs with fewer than 9 digits are usually stored without their leading zeros.
export function hasValidCheckDigit(id: string): boolean {
  const padded = id.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(padded[i]) * (i % 2 === 0 ? 1 : 2);
    if (v > 9) v = Math.floor(v / 10) + (v % 10);
    sum += v;
  }
  return sum % 10 === 0;
}

// Off by default: about 5 nine-digit records (and a few 8-digit ones) on the
// current list fail the check, so enabling it would lock those people out.
// Fix those records in the source data, then set ENFORCE_ID_CHECKSUM=true.
export function checksumEnforced(): boolean {
  return process.env.ENFORCE_ID_CHECKSUM === "true";
}
