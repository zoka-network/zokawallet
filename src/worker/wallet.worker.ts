// The Worker that holds the wallet: the WebAssembly (keys, scanning, proofs)
// and the vault run here, off the page's thread. The page asks for one of
// METHODS and gets the answer, plus every new state of the wallet.

import init, * as wasm from "../wasm/zoka_pq_wallet_wasm.js";
import { API } from "../config";
import { httpApi } from "../core/api";
import { VaultStore } from "../core/vault";
import { WalletCore, messageOf } from "../core/wallet-core";
import { METHODS, type CallMessage, type EventMessage, type ReplyMessage } from "./protocol";

const post = (message: ReplyMessage | EventMessage) =>
  (self as unknown as { postMessage(message: unknown): void }).postMessage(message);

const ready = (async () => {
  await init();
  const store = await VaultStore.open();
  return new WalletCore({ wasm, api: httpApi(API), store, emit: (state) => post({ event: "state", state }) });
})();
ready.catch((error: unknown) => post({ event: "fatal", error: messageOf(error) }));

self.addEventListener("message", async (event: MessageEvent<CallMessage>) => {
  const { id, method, params } = event.data;
  try {
    if (!(METHODS as readonly string[]).includes(method) || !Array.isArray(params)) {
      throw new Error("Unknown request");
    }
    const core = await ready;
    const call = core[method] as (...args: unknown[]) => unknown;
    post({ id, ok: true, result: await call.apply(core, params) });
  } catch (error) {
    post({ id, ok: false, error: messageOf(error) });
  }
});
