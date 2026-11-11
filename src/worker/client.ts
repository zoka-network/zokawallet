import type { CoreState, Quote, Recipient, Sent } from "../core/wallet-core";
import type { CallMessage, EventMessage, Method, ReplyMessage } from "./protocol";

/** The wallet as the page sees it: every call goes to the Worker. */
export interface WalletClient {
  current(): CoreState | null;
  subscribe(listener: (state: CoreState) => void): () => void;
  fatal(): string | null;

  init(): Promise<CoreState>;
  newPhrase(): Promise<string>;
  validPhrase(phrase: string): Promise<boolean>;
  create(password: string, name: string, phrase: string): Promise<CoreState>;
  unlock(password: string): Promise<CoreState>;
  lock(): Promise<CoreState>;
  addWallet(name: string, phrase: string): Promise<CoreState>;
  switchWallet(id: string): Promise<CoreState>;
  renameWallet(id: string, name: string): Promise<CoreState>;
  removeWallet(id: string): Promise<CoreState>;
  forgetAll(): Promise<CoreState>;
  revealPhrase(password: string): Promise<string>;
  viewKey(): Promise<string>;
  incomingViewKey(): Promise<string>;
  changePassword(current: string, next: string): Promise<void>;
  resolve(text: string): Promise<Recipient>;
  quote(amountAtoms: bigint): Promise<Quote>;
  send(to: string, amountAtoms: bigint, memo: string): Promise<Sent>;
  resubmit(): Promise<boolean>;
  cancelUnsent(): Promise<CoreState>;
  qr(text: string): Promise<Uint8Array>;
  refresh(): Promise<void>;
}

export function workerClient(worker: Worker): WalletClient {
  let next = 1;
  let state: CoreState | null = null;
  let fatal: string | null = null;
  const waiting = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  const listeners = new Set<(state: CoreState) => void>();

  worker.addEventListener("message", (event: MessageEvent<ReplyMessage | EventMessage>) => {
    const message = event.data;
    if ("event" in message) {
      if (message.event === "state") {
        state = message.state;
        listeners.forEach((listener) => listener(message.state));
      } else {
        fatal = message.error;
        listeners.forEach((listener) => state && listener(state));
      }
      return;
    }
    const call = waiting.get(message.id);
    if (!call) return;
    waiting.delete(message.id);
    if (message.ok) call.resolve(message.result);
    else call.reject(new Error(message.error));
  });

  const call = <T>(method: Method, ...params: unknown[]) =>
    new Promise<T>((resolve, reject) => {
      const id = next++;
      waiting.set(id, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ id, method, params } satisfies CallMessage);
    });

  return {
    current: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    fatal: () => fatal,
    init: () => call("init"),
    newPhrase: () => call("newPhrase"),
    validPhrase: (phrase) => call("validPhrase", phrase),
    create: (password, name, phrase) => call("create", password, name, phrase),
    unlock: (password) => call("unlock", password),
    lock: () => call("lock"),
    addWallet: (name, phrase) => call("addWallet", name, phrase),
    switchWallet: (id) => call("switchWallet", id),
    renameWallet: (id, name) => call("renameWallet", id, name),
    removeWallet: (id) => call("removeWallet", id),
    forgetAll: () => call("forgetAll"),
    revealPhrase: (password) => call("revealPhrase", password),
    viewKey: () => call("viewKey"),
    incomingViewKey: () => call("incomingViewKey"),
    changePassword: (current, next) => call("changePassword", current, next),
    resolve: (text) => call("resolve", text),
    quote: (amountAtoms) => call("quote", amountAtoms),
    send: (to, amountAtoms, memo) => call("send", to, amountAtoms, memo),
    resubmit: () => call("resubmit"),
    cancelUnsent: () => call("cancelUnsent"),
    qr: (text) => call("qr", text),
    refresh: () => call("refresh"),
  };
}
