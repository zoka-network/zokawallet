// The wallet itself, as it runs in the Worker. The recovery words live here
// and in the WebAssembly; the page only sees what it shows.
//
// Every step that waits (the network, the storage) is followed by a check of
// `generation`: locking or switching wallets bumps it, so a sync that was
// waiting for a page never touches the wallet that replaced it.

import type * as WasmModule from "../wasm/zoka_pq_wallet_wasm.js";
import { CHECKPOINT_EVERY_MS, KDF, MEMO_BYTES, MIN_PASSWORD, NETWORK, PAGE_BLOCKS, POLL_MS } from "../config";
import { memoBytes } from "../lib/amount";
import { parsePaymentText } from "../lib/payment";
import { ApiError, type Api } from "./api";
import {
  aad,
  importKey,
  randomBytes,
  randomId,
  seal,
  sealCheck,
  sealSecret,
  unseal,
  unsealSecret,
  verifyCheck,
  type KdfParams,
  type StateRecord,
  type VaultStore,
  type WalletRecord,
  type WalletSecret,
} from "./vault";

export type Wasm = Pick<
  typeof WasmModule,
  "WebWallet" | "newPhrase" | "validPhrase" | "addressKind" | "matchesShort" | "shortOf" | "deriveKey" | "qrMatrix"
>;
type WebWallet = WasmModule.WebWallet;

export interface Movement {
  txid: string;
  height: number;
  timestamp: number;
  kind: "received" | "sent" | "mined";
  amount_atoms: number;
  fee_atoms: number;
  memo: string;
  confirmations: number;
}

export interface OpenWallet {
  id: string;
  name: string;
  address: string;
  short: string;
  /** Its short address resolves for payers. */
  published: boolean;
  /** Finding the address stamp or handing the record to the node. */
  publishing: boolean;
  height: number;
  tip: number;
  /** The last block a signed checkpoint confirmed (0: none yet). */
  verified: number;
  inSync: boolean;
  spendable: number;
  immature: number;
  reserved: number;
  maxSendable: number;
  pending: { txid: string; expiry: number } | null;
  /** A payment proved here that the network has not confirmed receiving. */
  unsent: string | null;
  /** The other receive addresses of this wallet (point 4 of the 10/11 review). */
  extra: ExtraAddress[];
  /** Up to eight addresses, the main one included. */
  canAddAddress: boolean;
  history: Movement[];
}

/** A receive address besides the main one: whoever pays it cannot tell it is this wallet. */
export interface ExtraAddress {
  index: number;
  full: string;
  short: string;
  /** Its short address resolves for payers. */
  published: boolean;
}

/** How many addresses one wallet can have, the main one included. */
export const MAX_ADDRESSES = 8;

export interface CoreState {
  phase: "loading" | "empty" | "locked" | "open";
  wallets: { id: string; name: string }[];
  wallet: OpenWallet | null;
  sync: { state: "idle" | "syncing" | "offline"; error?: string };
  network: { height: number; hashrate: number; checkpoint: number; targetSecs: number; seen: number } | null;
  busy: null | "unlocking" | "creating" | "proving" | "sending";
}

export interface Recipient {
  full: string;
  short: string;
  amount?: string;
}

export interface Quote {
  enough: boolean;
  fee_atoms?: number;
  inputs?: number;
  reason?: string;
}

export interface Sent {
  txid: string;
  amount_atoms: number;
  fee_atoms: number;
  expiry: number;
  /** False: proved, but the network could not be reached. */
  delivered: boolean;
}

export interface CoreDeps {
  wasm: Wasm;
  api: Api;
  store: VaultStore;
  emit: (state: CoreState) => void;
  now?: () => number;
}

export class CoreError extends Error {}

interface ActiveWallet {
  id: string;
  order: number;
  secret: WalletSecret;
}

const normalize = (phrase: string) => phrase.trim().toLowerCase().split(/\s+/).join(" ");

interface WalletStatusJson {
  height: number;
  tip: number;
  in_sync: boolean;
  spendable_atoms: number;
  immature_atoms: number;
  reserved_atoms: number;
  max_sendable_atoms: number;
  verified: number;
  pending: { txid: string; expiry: number } | null;
  history: Movement[];
}

export class WalletCore {
  private readonly wasm: Wasm;
  private readonly api: Api;
  private readonly store: VaultStore;
  private readonly emitState: (state: CoreState) => void;
  private readonly now: () => number;

  private phase: CoreState["phase"] = "loading";
  private busy: CoreState["busy"] = null;
  private sync: CoreState["sync"] = { state: "idle" };
  private network: CoreState["network"] = null;

  private key: CryptoKey | null = null;
  private names: { id: string; name: string; order: number }[] = [];
  private active: ActiveWallet | null = null;
  private wallet: WebWallet | null = null;
  private address = { full: "", short: "" };
  private extra: { index: number; full: string; short: string }[] = [];
  private unsent: { txid: string; bytes: Uint8Array } | null = null;
  private record: string | null = null;
  private publishing = false;
  /** After a failed publication, the next try waits (1, 2, 4… 15 minutes). */
  private publishAfter = 0;
  private publishFailures = 0;

  private generation = 0;
  private controller = new AbortController();
  private wake: (() => void) | null = null;
  private lastCheckpoint = 0;
  /** What the last save held (height, checkpoint, pending), and its height. */
  private savedMark = "";
  private savedAt = -1;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(deps: CoreDeps) {
    this.wasm = deps.wasm;
    this.api = deps.api;
    this.store = deps.store;
    this.emitState = deps.emit;
    this.now = deps.now ?? Date.now;
  }

  // ---- what the page reads ------------------------------------------------

  snapshot(): CoreState {
    return {
      phase: this.phase,
      wallets: this.names.map(({ id, name }) => ({ id, name })),
      wallet: this.openWallet(),
      sync: this.sync,
      network: this.network,
      busy: this.busy,
    };
  }

  private openWallet(): OpenWallet | null {
    if (!this.wallet || !this.active) return null;
    const status = JSON.parse(this.wallet.status()) as WalletStatusJson;
    return {
      id: this.active.id,
      name: this.active.secret.name,
      address: this.address.full,
      short: this.address.short,
      published: this.active.secret.published,
      publishing: this.publishing,
      height: status.height,
      // The tip is the node's latest status; a page may name a block newer still.
      tip: Math.max(this.network?.height ?? status.tip, status.height),
      verified: status.verified,
      inSync: status.height >= (this.network?.height ?? status.tip),
      spendable: status.spendable_atoms,
      immature: status.immature_atoms,
      reserved: status.reserved_atoms,
      maxSendable: status.max_sendable_atoms,
      pending: status.pending,
      unsent: this.unsent?.txid ?? null,
      extra: this.extra.map((a) => ({ ...a, published: (this.active!.secret.publishedExtra ?? []).includes(a.index) })),
      canAddAddress: this.extra.length + 1 < MAX_ADDRESSES,
      history: status.history,
    };
  }

  private emit(): void {
    this.emitState(this.snapshot());
  }

  private exclusive<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private requireOpen(): { wallet: WebWallet; active: ActiveWallet; key: CryptoKey } {
    if (!this.wallet || !this.active || !this.key) throw new CoreError("The wallet is locked");
    return { wallet: this.wallet, active: this.active, key: this.key };
  }

  // ---- opening and closing ------------------------------------------------

  async init(): Promise<CoreState> {
    const header = await this.store.header();
    this.phase = header ? "locked" : "empty";
    this.emit();
    return this.snapshot();
  }

  newPhrase(): string {
    return this.wasm.newPhrase();
  }

  validPhrase(phrase: string): boolean {
    return this.wasm.validPhrase(phrase);
  }

  private async deriveKey(password: string, kdf: KdfParams): Promise<CryptoKey> {
    return importKey(this.wasm.deriveKey(password, kdf.salt, kdf.memoryKib, kdf.iterations));
  }

  /** The first wallet of this browser, and the password that seals it. */
  create(password: string, name: string, phrase: string): Promise<CoreState> {
    return this.exclusive(async () => {
      if (await this.store.header()) throw new CoreError("This browser already has wallets: unlock them first");
      if (password.length < MIN_PASSWORD) throw new CoreError(`Use a password of ${MIN_PASSWORD} characters or more`);
      if (!this.wasm.validPhrase(phrase)) throw new CoreError("Those are not 24 valid recovery words");
      this.busy = "creating";
      this.emit();
      try {
        const kdf: KdfParams = { memoryKib: KDF.memoryKib, iterations: KDF.iterations, salt: randomBytes(16) };
        const key = await this.deriveKey(password, kdf);
        const id = randomId();
        const secret: WalletSecret = { name: cleanName(name), phrase: normalize(phrase), created: this.now(), published: false };
        const record: WalletRecord = { id, order: 0, secret: await sealSecret(key, id, secret) };
        await this.store.write({
          header: { version: 1, kdf, check: await sealCheck(key), created: this.now() },
          wallets: [record],
          active: id,
        });
        this.key = key;
        this.names = [{ id, name: secret.name, order: 0 }];
        this.open(record, secret, null);
      } finally {
        // Also after a failure: the page leaves its "working" screen.
        this.busy = null;
        this.emit();
      }
      return this.snapshot();
    });
  }

  unlock(password: string): Promise<CoreState> {
    return this.exclusive(async () => {
      const header = await this.store.header();
      if (!header) throw new CoreError("This browser has no wallet");
      this.busy = "unlocking";
      this.emit();
      try {
        const key = await this.deriveKey(password, header.kdf);
        if (!(await verifyCheck(key, header.check))) throw new CoreError("Wrong password");
        const records = await this.store.wallets();
        if (records.length === 0) throw new CoreError("This browser's copy of the wallet is damaged");
        const names = [];
        for (const record of records) {
          names.push({ id: record.id, name: (await unsealSecret(key, record)).name, order: record.order });
        }
        const wanted = await this.store.active();
        const record = records.find((r) => r.id === wanted) ?? records[0]!;
        const secret = await unsealSecret(key, record);
        const state = await this.store.state(record.id);
        this.key = key;
        this.names = names;
        this.open(record, secret, state ? await unseal(key, aad.state(record.id), state.state) : null);
      } finally {
        this.busy = null;
        this.emit();
      }
      return this.snapshot();
    });
  }

  /** Builds the WebAssembly wallet and starts following the chain. */
  private open(record: WalletRecord, secret: WalletSecret, state: Uint8Array | null): void {
    this.close();
    let wallet: WebWallet;
    try {
      wallet = new this.wasm.WebWallet(secret.phrase, NETWORK, state ?? new Uint8Array());
    } catch {
      // A saved state this version cannot read: read the chain again.
      wallet = new this.wasm.WebWallet(secret.phrase, NETWORK, new Uint8Array());
    }
    this.wallet = wallet;
    this.active = { id: record.id, order: record.order, secret };
    // The addresses it had, before reading anything: a state read again
    // from scratch still finds what came to each.
    const want = Math.min(Math.max(secret.addresses ?? 1, 1), MAX_ADDRESSES);
    while (wallet.addresses() < want) wallet.addAddress();
    this.address = { full: wallet.address(), short: wallet.shortAddress() };
    this.extra = [];
    for (let index = 1; index < wallet.addresses(); index++) {
      this.extra.push({ index, full: wallet.addressAt(index), short: wallet.shortAddressAt(index) });
    }
    this.savedMark = "";
    this.savedAt = state ? wallet.next() - 1 : -1;
    this.phase = "open";
    this.sync = { state: "syncing" };
    void this.follow(this.generation);
    for (const { index } of this.extra) {
      if (!(secret.publishedExtra ?? []).includes(index)) void this.publishExtra(this.generation, index);
    }
  }

  /** Stops the sync and frees the WebAssembly wallet. */
  private close(): void {
    this.generation++;
    this.controller.abort(new DOMException("The wallet was closed", "AbortError"));
    this.controller = new AbortController();
    this.wake?.();
    this.wake = null;
    this.wallet?.free();
    this.wallet = null;
    this.active = null;
    this.address = { full: "", short: "" };
    this.extra = [];
    this.unsent = null;
    this.record = null;
    this.publishing = false;
    this.publishAfter = 0;
    this.publishFailures = 0;
    this.lastCheckpoint = 0;
    this.sync = { state: "idle" };
  }

  lock(): CoreState {
    this.close();
    this.key = null;
    this.names = [];
    if (this.phase === "open") this.phase = "locked";
    this.emit();
    return this.snapshot();
  }

  private async checkPassword(password: string): Promise<void> {
    const header = await this.store.header();
    if (!header) throw new CoreError("This browser has no wallet");
    const key = await this.deriveKey(password, header.kdf);
    if (!(await verifyCheck(key, header.check))) throw new CoreError("Wrong password");
  }

  // ---- following the chain ------------------------------------------------

  /** Wake the sync now (after a payment, or when the page comes back). */
  refresh(): void {
    this.wake?.();
  }

  private live(generation: number): boolean {
    return generation === this.generation && this.wallet !== null;
  }

  private pause(generation: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, ms);
      const self = this;
      function done() {
        clearTimeout(timer);
        if (self.wake === done) self.wake = null;
        resolve();
      }
      if (this.live(generation)) this.wake = done;
      else done();
    });
  }

  private async follow(generation: number): Promise<void> {
    let failures = 0;
    while (this.live(generation)) {
      try {
        await this.syncOnce(generation);
        failures = 0;
        if (!this.live(generation)) return;
        this.sync = { state: "idle" };
        this.emit();
        if (!this.publishing && !this.active?.secret.published && this.now() >= this.publishAfter) {
          void this.publishAddress(generation);
        }
      } catch (error) {
        if (!this.live(generation)) return;
        failures++;
        this.sync = { state: "offline", error: messageOf(error) };
        this.emit();
      }
      await this.pause(generation, failures ? Math.min(POLL_MS * 2 ** failures, 5 * 60_000) : POLL_MS);
    }
  }

  private async syncOnce(generation: number): Promise<void> {
    const signal = this.controller.signal;
    const status = await this.api.status(signal);
    if (!this.live(generation)) return;
    this.network = {
      height: status.height,
      hashrate: status.hashrate_estimate_hps,
      checkpoint: status.checkpoint?.height ?? 0,
      targetSecs: status.target_block_secs,
      seen: this.now(),
    };
    while (this.live(generation) && this.wallet!.next() <= status.height) {
      this.sync = { state: "syncing" };
      this.emit();
      const before = this.wallet!.next();
      const page = await this.api.scan2(before, PAGE_BLOCKS, signal);
      if (!this.live(generation)) return;
      const tip = this.wallet!.addPage(page);
      this.emit();
      // Nothing new on this page, or the node is behind the status it gave.
      if (this.wallet!.next() === before || this.wallet!.next() > tip) break;
      // Save now and then: a long first read survives a closed tab.
      if (this.wallet!.next() - 1 - this.savedAt >= 1_000) await this.save(generation);
    }
    if (!this.live(generation)) return;
    const verified = (JSON.parse(this.wallet!.status()) as WalletStatusJson).verified;
    const newer = (status.checkpoint?.height ?? 0) > verified;
    if (newer || this.now() - this.lastCheckpoint >= CHECKPOINT_EVERY_MS) {
      const checkpoint = await this.api.checkpoint(signal);
      if (!this.live(generation)) return;
      if (checkpoint.trim() !== "null") this.wallet!.confirmCheckpoint(checkpoint);
      this.lastCheckpoint = this.now();
    }
    await this.save(generation);
  }

  /** The state read so far, sealed. Skipped when nothing new was read. */
  private save(generation: number, force = false): Promise<void> {
    return this.exclusive(async () => {
      if (!this.live(generation) || !this.key || !this.active) return;
      const status = JSON.parse(this.wallet!.status()) as WalletStatusJson;
      const mark = `${status.height}/${status.verified}/${status.pending?.txid ?? ""}`;
      if (!force && mark === this.savedMark) return;
      const id = this.active.id;
      const state: StateRecord = { id, state: await seal(this.key, aad.state(id), this.wallet!.encodeState()) };
      if (!this.live(generation)) return;
      await this.store.write({ states: [state] });
      this.savedMark = mark;
      this.savedAt = status.height;
    });
  }

  /**
   * Makes the short address resolve: if no node knows it yet, the Worker
   * finds its Argon2id stamp (seconds) and the public node keeps the record.
   */
  private async publishAddress(generation: number): Promise<void> {
    if (!this.active || this.active.secret.published || this.publishing) return;
    this.publishing = true;
    this.emit();
    try {
      const signal = this.controller.signal;
      const known = await this.api.resolve(this.address.short, signal);
      if (!this.live(generation)) return;
      if (!known || !this.wasm.matchesShort(known, this.address.short, NETWORK)) {
        // Let the page draw "publishing" before the Worker is busy for seconds.
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (!this.live(generation)) return;
        this.record ??= this.wallet!.addressRecord();
        await this.api.publish(this.record, signal);
        if (!this.live(generation)) return;
      }
      await this.updateSecret(generation, { published: true });
      this.publishFailures = 0;
    } catch {
      // Busy, offline or an older node: later, with the same stamp.
      this.publishFailures++;
      this.publishAfter = this.now() + Math.min(60_000 * 2 ** (this.publishFailures - 1), 15 * 60_000);
    } finally {
      if (this.live(generation)) {
        this.publishing = false;
        this.emit();
      }
    }
  }

  private updateSecret(generation: number, change: Partial<WalletSecret>): Promise<void> {
    return this.exclusive(async () => {
      if (!this.live(generation) || !this.key || !this.active) return;
      const secret = { ...this.active.secret, ...change };
      const record: WalletRecord = {
        id: this.active.id,
        order: this.active.order,
        secret: await sealSecret(this.key, this.active.id, secret),
      };
      await this.store.write({ wallets: [record] });
      this.active.secret = secret;
      const named = this.names.find((n) => n.id === record.id);
      if (named) named.name = secret.name;
    });
  }

  // ---- several wallets ----------------------------------------------------

  /** Another wallet in this browser (new words or restored ones), opened. */
  addWallet(name: string, phrase: string): Promise<CoreState> {
    return this.exclusive(async () => {
      const { key } = this.requireOpen();
      if (!this.wasm.validPhrase(phrase)) throw new CoreError("Those are not 24 valid recovery words");
      const records = await this.store.wallets();
      for (const record of records) {
        if ((await unsealSecret(key, record)).phrase === normalize(phrase)) {
          throw new CoreError("That wallet is already in this browser");
        }
      }
      const id = randomId();
      const order = Math.max(-1, ...records.map((r) => r.order)) + 1;
      const secret: WalletSecret = { name: cleanName(name), phrase: normalize(phrase), created: this.now(), published: false };
      const record: WalletRecord = { id, order, secret: await sealSecret(key, id, secret) };
      await this.store.write({ wallets: [record], active: id });
      this.names.push({ id, name: secret.name, order });
      this.open(record, secret, null);
      this.emit();
      return this.snapshot();
    });
  }

  switchWallet(id: string): Promise<CoreState> {
    return this.exclusive(async () => {
      const { key, active } = this.requireOpen();
      if (active.id === id) return this.snapshot();
      const record = (await this.store.wallets()).find((r) => r.id === id);
      if (!record) throw new CoreError("That wallet is not in this browser");
      const secret = await unsealSecret(key, record);
      const state = await this.store.state(id);
      await this.store.write({ active: id });
      this.open(record, secret, state ? await unseal(key, aad.state(id), state.state) : null);
      this.emit();
      return this.snapshot();
    });
  }

  renameWallet(id: string, name: string): Promise<CoreState> {
    return this.exclusive(async () => {
      const { key, active } = this.requireOpen();
      const record = (await this.store.wallets()).find((r) => r.id === id);
      if (!record) throw new CoreError("That wallet is not in this browser");
      const secret = { ...(await unsealSecret(key, record)), name: cleanName(name) };
      await this.store.write({ wallets: [{ ...record, secret: await sealSecret(key, id, secret) }] });
      if (active.id === id) active.secret = { ...active.secret, name: secret.name };
      const named = this.names.find((n) => n.id === id);
      if (named) named.name = secret.name;
      this.emit();
      return this.snapshot();
    });
  }

  /** Forget one wallet of several: its words must be written down elsewhere. */
  removeWallet(id: string): Promise<CoreState> {
    return this.exclusive(async () => {
      const { key, active } = this.requireOpen();
      const records = await this.store.wallets();
      if (records.length <= 1) throw new CoreError("This is the only wallet here: use “Forget this browser’s wallets”");
      const rest = records.filter((r) => r.id !== id);
      if (rest.length === records.length) throw new CoreError("That wallet is not in this browser");
      const next = rest[0]!;
      await this.store.write({ remove: [id], active: active.id === id ? next.id : active.id });
      this.names = this.names.filter((n) => n.id !== id);
      if (active.id === id) {
        const secret = await unsealSecret(key, next);
        const state = await this.store.state(next.id);
        this.open(next, secret, state ? await unseal(key, aad.state(next.id), state.state) : null);
      }
      this.emit();
      return this.snapshot();
    });
  }

  /** Every wallet of this browser, gone (their words still restore them). */
  forgetAll(): Promise<CoreState> {
    return this.exclusive(async () => {
      this.close();
      this.key = null;
      this.names = [];
      await this.store.destroy();
      this.phase = "empty";
      this.emit();
      return this.snapshot();
    });
  }

  // ---- secrets --------------------------------------------------------------

  async revealPhrase(password: string): Promise<string> {
    const { active } = this.requireOpen();
    await this.checkPassword(password);
    return active.secret.phrase;
  }

  viewKey(): string {
    return this.requireOpen().wallet.viewKey();
  }

  incomingViewKey(): string {
    return this.requireOpen().wallet.incomingViewKey();
  }

  /**
   * Another receive address (point 4 of the 10/11 review): whoever pays two
   * of them cannot tell they paid one wallet. Payments to it are found from
   * the next block on, so it is made before it is given out; its short form
   * is published right after.
   */
  async addAddress(): Promise<CoreState> {
    const generation = this.generation;
    const index = await this.exclusive(async () => {
      const { wallet } = this.requireOpen();
      if (wallet.addresses() >= MAX_ADDRESSES) {
        throw new CoreError(`A wallet has at most ${MAX_ADDRESSES} addresses`);
      }
      const index = wallet.addAddress();
      this.extra.push({ index, full: wallet.addressAt(index), short: wallet.shortAddressAt(index) });
      await this.saveNow(generation);
      return index;
    });
    await this.updateSecret(generation, { addresses: index + 1 });
    this.emit();
    void this.publishExtra(generation, index);
    return this.snapshot();
  }

  /** Makes an extra address's short form resolve, as `publishAddress` does. */
  private async publishExtra(generation: number, index: number): Promise<void> {
    const address = this.extra.find((a) => a.index === index);
    if (!address) return;
    try {
      const signal = this.controller.signal;
      const known = await this.api.resolve(address.short, signal);
      if (!this.live(generation) || !this.wallet) return;
      if (!known || !this.wasm.matchesShort(known, address.short, NETWORK)) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (!this.live(generation) || !this.wallet) return;
        await this.api.publish(this.wallet.addressRecordAt(index), signal);
        if (!this.live(generation)) return;
      }
      const published = [...new Set([...(this.active?.secret.publishedExtra ?? []), index])];
      await this.updateSecret(generation, { publishedExtra: published });
      this.emit();
    } catch {
      // Offline or busy: tried again the next time the wallet opens.
    }
  }

  /** Seals everything again under a new password, in one write. */
  changePassword(current: string, next: string): Promise<void> {
    return this.exclusive(async () => {
      const { key } = this.requireOpen();
      if (next.length < MIN_PASSWORD) throw new CoreError(`Use a password of ${MIN_PASSWORD} characters or more`);
      await this.checkPassword(current);
      const kdf: KdfParams = { memoryKib: KDF.memoryKib, iterations: KDF.iterations, salt: randomBytes(16) };
      const fresh = await this.deriveKey(next, kdf);
      const wallets: WalletRecord[] = [];
      for (const record of await this.store.wallets()) {
        wallets.push({ ...record, secret: await sealSecret(fresh, record.id, await unsealSecret(key, record)) });
      }
      const states: StateRecord[] = [];
      for (const record of await this.store.states()) {
        const state = await unseal(key, aad.state(record.id), record.state);
        states.push({ id: record.id, state: await seal(fresh, aad.state(record.id), state) });
      }
      const header = await this.store.header();
      await this.store.write({
        header: { version: 1, kdf, check: await sealCheck(fresh), created: header?.created ?? this.now() },
        wallets,
        states,
      });
      this.key = fresh;
    });
  }

  // ---- paying ---------------------------------------------------------------

  /**
   * Who a payment goes to. A short address is looked up at the public node,
   * and its answer is checked here: the short address is a digest of the full
   * one, so the node cannot hand over somebody else's.
   */
  async resolve(text: string): Promise<Recipient> {
    const { address, amount } = parsePaymentText(text);
    const kind = this.wasm.addressKind(address, NETWORK);
    if (kind === "full") return { full: address, short: this.wasm.shortOf(address, NETWORK), ...(amount ? { amount } : {}) };
    if (kind !== "short") throw new CoreError("That is not a Zoka Quantic Testnet address");
    const full = await this.api.resolve(address, this.controller.signal);
    if (!full) {
      throw new CoreError("Nobody has published that short address yet: ask for the full address");
    }
    if (!this.wasm.matchesShort(full, address, NETWORK)) {
      throw new CoreError("The node answered with an address that does not match: payment stopped");
    }
    return { full, short: address, ...(amount ? { amount } : {}) };
  }

  quote(amountAtoms: bigint): Quote {
    return JSON.parse(this.requireOpen().wallet.quote(amountAtoms)) as Quote;
  }

  /**
   * Proves the payment here (seconds of WebAssembly), keeps its notes
   * reserved, and hands it to the public node, which relays it to the miners.
   */
  send(to: string, amountAtoms: bigint, memo: string): Promise<Sent> {
    return this.exclusive(async () => {
      const { wallet } = this.requireOpen();
      const generation = this.generation;
      if (this.unsent) throw new CoreError("A payment is still waiting to reach the network");
      if (memoBytes(memo) > MEMO_BYTES) throw new CoreError(`The note can have ${MEMO_BYTES} bytes at most`);
      if (this.wasm.addressKind(to, NETWORK) !== "full") throw new CoreError("Pay to a full address");
      this.busy = "proving";
      this.emit();
      let proved: Omit<Sent, "delivered">;
      let bytes: Uint8Array;
      try {
        // Let the page draw "proving" before the Worker is busy for seconds.
        await new Promise((resolve) => setTimeout(resolve, 30));
        proved = JSON.parse(wallet.prove(to, amountAtoms, memo)) as Omit<Sent, "delivered">;
        bytes = wallet.lastTransaction();
      } catch (error) {
        this.busy = null;
        this.emit();
        throw new CoreError(messageOf(error));
      }
      this.unsent = { txid: proved.txid, bytes };
      await this.saveNow(generation);
      return { ...proved, delivered: await this.deliver(generation) };
    });
  }

  /** Try again to hand the proved payment to the network. */
  resubmit(): Promise<boolean> {
    return this.exclusive(async () => {
      this.requireOpen();
      if (!this.unsent) return true;
      return this.deliver(this.generation);
    });
  }

  /** Give up on a payment that never reached the network: its notes return. */
  cancelUnsent(): Promise<CoreState> {
    return this.exclusive(async () => {
      const { wallet } = this.requireOpen();
      if (this.unsent) {
        wallet.release();
        this.unsent = null;
        await this.saveNow(this.generation);
      }
      this.emit();
      return this.snapshot();
    });
  }

  private async deliver(generation: number): Promise<boolean> {
    const unsent = this.unsent;
    if (!unsent) return true;
    this.busy = "sending";
    this.emit();
    try {
      await this.api.submit(unsent.bytes, unsent.txid, this.controller.signal);
      this.unsent = null;
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.refused && this.live(generation)) {
        // The node checked it and said no: nothing will spend those notes.
        this.wallet!.release();
        this.unsent = null;
        await this.saveNow(generation);
        throw new CoreError(`The network refused the payment: ${error.message}`);
      }
      return false;
    } finally {
      this.busy = null;
      this.emit();
      this.refresh();
    }
  }

  /** `save` for callers already inside `exclusive`. */
  private async saveNow(generation: number): Promise<void> {
    if (!this.live(generation) || !this.key || !this.active) return;
    const id = this.active.id;
    await this.store.write({ states: [{ id, state: await seal(this.key, aad.state(id), this.wallet!.encodeState()) }] });
    this.savedMark = "";
  }

  qr(text: string): Uint8Array {
    return this.wasm.qrMatrix(text);
  }
}

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, 40);
  return trimmed || "Wallet";
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong";
}

