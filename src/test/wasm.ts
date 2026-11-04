// The real WebAssembly of the wallet, loaded in Node for the tests.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as wasm from "../wasm/zoka_pq_wallet_wasm.js";

let loaded = false;

export function loadWasm(): typeof wasm {
  if (!loaded) {
    const bytes = readFileSync(fileURLToPath(new URL("../wasm/zoka_pq_wallet_wasm_bg.wasm", import.meta.url)));
    wasm.initSync({ module: bytes });
    loaded = true;
  }
  return wasm;
}

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))));
}

export function fixtureText(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}
