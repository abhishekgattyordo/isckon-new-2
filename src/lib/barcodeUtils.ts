/**
 * GS1 standard EAN-13 Barcode Generator Utility for ISKCON Retail ERP
 * Uses Indian Retail prefix 890 with standard Modulo-10 checksum algorithm.
 */

export function generateEan13Barcode(prefix = '890', seed?: string | number): string {
  let numStr = '';
  if (seed !== undefined && seed !== null && String(seed).trim() !== '') {
    const s = String(seed).trim();
    // Deterministic hash based on input string
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    const absHash = Math.abs(hash);
    const timeFragment = Date.now().toString().slice(-4);
    numStr = `${String(absHash).slice(-5).padStart(5, '0')}${timeFragment}`.slice(-9);
  } else {
    // Unique timestamp + random sequence
    const timePart = Date.now().toString().slice(-6);
    const randPart = Math.floor(100 + Math.random() * 900).toString();
    numStr = `${timePart}${randPart}`;
  }

  // Ensure 12 digits before checksum
  const raw12 = `${prefix}${numStr}`.padEnd(12, '0').slice(0, 12);

  // Compute standard EAN-13 Modulo-10 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(raw12[i], 10) || 0;
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${raw12}${checkDigit}`;
}

/**
 * Validates whether a barcode string conforms to 13-digit EAN-13 standard
 */
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return parseInt(code[12], 10) === checkDigit;
}
