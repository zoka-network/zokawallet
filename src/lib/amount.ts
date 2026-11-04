import { ATOMS, DECIMALS, MAX_SUPPLY_ATOMS } from "../config";

// Amounts are atoms in a bigint: never a float, so 0.1 + 0.2 stays exact.

export class AmountError extends Error {}

/** "1,234.5" for 1_234_500_000 atoms: thousands grouped, trailing zeros cut. */
export function formatZka(atoms: bigint | number | string, minDecimals = 2): string {
  const value = BigInt(atoms);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = (abs / ATOMS).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let fraction = (abs % ATOMS).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  if (fraction.length < minDecimals) fraction = fraction.padEnd(minDecimals, "0");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** What a person typed, in ZKA, as atoms. Commas and spaces are ignored. */
export function parseZka(text: string): bigint {
  const clean = text.trim().replace(/[\s,]/g, "");
  if (!clean) throw new AmountError("Enter an amount");
  const match = /^(\d*)(?:\.(\d*))?$/.exec(clean);
  if (!match || (!match[1] && !match[2])) throw new AmountError("That is not an amount");
  const [, whole = "", fraction = ""] = match;
  if (fraction.length > DECIMALS) {
    throw new AmountError(`ZKA has ${DECIMALS} decimals at most`);
  }
  const atoms = BigInt(whole || "0") * ATOMS + BigInt(fraction.padEnd(DECIMALS, "0") || "0");
  if (atoms <= 0n) throw new AmountError("The amount must be more than zero");
  if (atoms > MAX_SUPPLY_ATOMS) throw new AmountError("That is more ZKA than will ever exist");
  return atoms;
}

/** The atoms back as text a person would type (no grouping). */
export function atomsToInput(atoms: bigint): string {
  return formatZka(atoms, 0).replace(/,/g, "");
}

/** The UTF-8 length of a memo, which is what the payment limits. */
export function memoBytes(memo: string): number {
  return new TextEncoder().encode(memo).length;
}
