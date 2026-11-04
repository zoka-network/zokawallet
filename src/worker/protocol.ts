import type { CoreState } from "../core/wallet-core";

/** What the page may ask the Worker: nothing else is called. */
export const METHODS = [
  "init",
  "newPhrase",
  "validPhrase",
  "create",
  "unlock",
  "lock",
  "addWallet",
  "switchWallet",
  "renameWallet",
  "removeWallet",
  "forgetAll",
  "revealPhrase",
  "viewKey",
  "changePassword",
  "resolve",
  "quote",
  "send",
  "resubmit",
  "cancelUnsent",
  "qr",
  "refresh",
] as const;

export type Method = (typeof METHODS)[number];

export interface CallMessage {
  id: number;
  method: Method;
  params: unknown[];
}

export type ReplyMessage = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };

export type EventMessage = { event: "state"; state: CoreState } | { event: "fatal"; error: string };
