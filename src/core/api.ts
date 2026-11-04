// The node's public API, as the wallet uses it. Every request leaves without
// cookies or a referrer; what the node learns is which pages of the chain were
// read (the same for every wallet), a payment already proved, and an address
// record already stamped.

export interface NodeStatus {
  chain_id: string;
  height: number;
  hash: string;
  tip_timestamp: number;
  hashrate_estimate_hps: number;
  target_block_secs: number;
  node_version: string;
  checkpoint: { height: number; block_hash: string } | null;
  mempool_transactions?: number;
  peers?: { inbound: number; outbound: number };
}

export interface TransactionStatus {
  txid: string;
  status: "pending" | "confirmed";
  height?: number;
  block_hash?: string;
  confirmations?: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
  /** The node read the request and said no: sending it again changes nothing. */
  get refused(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 408 && this.status !== 429;
  }
}

export interface Api {
  status(signal?: AbortSignal): Promise<NodeStatus>;
  scan2(from: number, count: number, signal?: AbortSignal): Promise<Uint8Array>;
  checkpoint(signal?: AbortSignal): Promise<string>;
  /** The full address behind a short one, or null if the node does not know it. */
  resolve(short: string, signal?: AbortSignal): Promise<string | null>;
  transaction(txid: string, signal?: AbortSignal): Promise<TransactionStatus | null>;
  /** POST /transactions: resolves once the node holds the payment. */
  submit(tx: Uint8Array, txid: string, signal?: AbortSignal): Promise<void>;
  /** POST /address with the record exactly as the WebAssembly wrote it. */
  publish(record: string, signal?: AbortSignal): Promise<void>;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/** Reads keep trying for about a minute; a write gives up sooner and says so. */
const RETRIES = 6;
const WRITE_RETRIES = 1;
const MAX_WAIT_MS = 60_000;

async function errorOf(response: Response): Promise<ApiError> {
  let message = `The node answered ${response.status}`;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) message = body.error;
  } catch {
    // Not JSON: keep the status.
  }
  return new ApiError(response.status, message);
}

export function httpApi(base: string, fetchFn: typeof fetch = (...args) => fetch(...args)): Api {
  // Busy (429, 503) waits for Retry-After; a lost connection is tried again a
  // few times (the browser reports a refused CORS request the same way, so a
  // write does not insist). Anything else is the node's answer.
  async function request(path: string, init: RequestInit, signal?: AbortSignal, retries = RETRIES): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await fetchFn(`${base}${path}`, {
          ...init,
          signal,
          credentials: "omit",
          referrerPolicy: "no-referrer",
          redirect: "error",
        });
      } catch (error) {
        if (signal?.aborted) throw error;
        if (attempt >= retries) throw new ApiError(0, "The Zoka network cannot be reached right now");
        await sleep(Math.min(1_000 * 2 ** attempt, MAX_WAIT_MS), signal);
        continue;
      }
      if ((response.status === 429 || response.status === 503) && attempt < Math.max(retries, 3)) {
        const after = Number(response.headers.get("Retry-After"));
        const wait = Number.isFinite(after) && after > 0 ? after * 1_000 : 1_000 * 2 ** attempt;
        await sleep(Math.min(wait, MAX_WAIT_MS), signal);
        continue;
      }
      return response;
    }
  }

  async function json<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await request(path, { cache: "no-store" }, signal);
    if (!response.ok) throw await errorOf(response);
    return (await response.json()) as T;
  }

  async function transaction(txid: string, signal?: AbortSignal): Promise<TransactionStatus | null> {
    const response = await request(`/transactions/${txid}`, { cache: "no-store" }, signal);
    if (response.status === 404) return null;
    if (!response.ok) throw await errorOf(response);
    return (await response.json()) as TransactionStatus;
  }

  return {
    status: (signal) => json<NodeStatus>("/status", signal),

    async scan2(from, count, signal) {
      const response = await request(`/scan2?from=${from}&count=${count}`, {}, signal);
      if (!response.ok) throw await errorOf(response);
      return new Uint8Array(await response.arrayBuffer());
    },

    async checkpoint(signal) {
      const response = await request("/checkpoint", { cache: "no-store" }, signal);
      if (!response.ok) throw await errorOf(response);
      return response.text();
    },

    async resolve(short, signal) {
      const response = await request(`/address/${encodeURIComponent(short)}`, { cache: "no-store" }, signal);
      if (response.status === 404) return null;
      if (!response.ok) throw await errorOf(response);
      const body = (await response.json()) as { address?: unknown };
      return typeof body.address === "string" ? body.address : null;
    },

    transaction,

    async submit(tx, txid, signal) {
      for (let attempt = 0; ; attempt++) {
        let response: Response;
        try {
          response = await request(
            "/transactions",
            { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: new Uint8Array(tx) },
            signal,
            WRITE_RETRIES,
          );
        } catch (error) {
          // The upload may have arrived before the connection broke.
          if (signal?.aborted) throw error;
          const known = await transaction(txid, signal).catch(() => null);
          if (known) return;
          if (attempt >= 2) throw error;
          continue;
        }
        if (response.ok) return;
        const error = await errorOf(response);
        // Sent twice (the first answer was lost): it is already waiting.
        if (error.status === 422 && /already in mempool/i.test(error.message)) return;
        throw error;
      }
    },

    async publish(record, signal) {
      const response = await request(
        "/address",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: record },
        signal,
        WRITE_RETRIES,
      );
      if (!response.ok) throw await errorOf(response);
    },
  };
}
