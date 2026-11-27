// Zoka ID (docs/ZOKA-ID.md of the node repository): the mosaic (v1) and the
// 80-bit code (v2) of a short address. The same address gives the same ID in
// ZKAPriv, ZSilent, this wallet and ZokaScan, so a payer can confirm a
// recipient by comparing codes.

const SEED_DOMAIN = "ZKAPriv/avatar/v1/seed\0";
const GRID_DOMAIN = "ZKAPriv/avatar/v1/grid\0";
const VALID = /^[A-Za-z0-9:._-]{1,256}$/;

/** Colours by mosaic value, fixed in both themes. */
export const ZOKA_ID_PALETTE = ["#080809", "#303036", "#AAAAAF", "#FAFAFA", "#F2ABD0"] as const;
export const ZOKA_ID_BACKGROUND = "#101012";
export const ZOKA_ID_SIDE = 9;

export interface ZokaId {
  /** Five groups of four hex characters; the first two are the v1 code. */
  code: string;
  /** 81 values from 0 to 4, row by row. */
  cells: number[];
}

const encoder = new TextEncoder();

async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  const data = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    data.set(part, offset);
    offset += part.length;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

/** The ID of a short address, or null for an input that has none. */
export async function zokaId(short: string): Promise<ZokaId | null> {
  if (!VALID.test(short) || !globalThis.crypto?.subtle) return null;
  const seed = await sha256(encoder.encode(SEED_DOMAIN), encoder.encode(short));
  const hex = Array.from(seed.slice(0, 10), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const code = hex.match(/.{4}/g)!.join("-");
  const cells: number[] = [];
  for (let n = 0; cells.length < ZOKA_ID_SIDE * ZOKA_ID_SIDE; n++) {
    const counter = new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
    const block = await sha256(encoder.encode(GRID_DOMAIN), seed, counter);
    for (const byte of block) {
      // 255 is divisible by 5: skipping it keeps the five values equally likely.
      if (byte < 255) cells.push(byte % 5);
      if (cells.length === ZOKA_ID_SIDE * ZOKA_ID_SIDE) break;
    }
  }
  return { code, cells };
}
