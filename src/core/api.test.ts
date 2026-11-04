// @vitest-environment node
import { ApiError, httpApi } from "./api";

type Reply = Response | Error;

function fakeFetch(replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift();
    if (!reply) throw new Error("no more replies");
    if (reply instanceof Error) throw reply;
    return reply;
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

async function settle<T>(promise: Promise<T>): Promise<T> {
  const done = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const result = await done;
  if ("error" in result) throw result.error;
  return result.value;
}

describe("the node's public API", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits as long as a busy node asks, then reads", async () => {
    const { fetchFn, calls } = fakeFetch([json(429, { error: "too many requests" }, { "Retry-After": "7" }), json(200, { height: 9 })]);
    const api = httpApi("https://api.example", fetchFn);
    const started = Date.now();
    const status = await settle(api.status());
    expect(status.height).toBe(9);
    expect(Date.now() - started).toBeGreaterThanOrEqual(7_000);
    expect(calls).toHaveLength(2);
    // Nothing that would identify the browser goes with it.
    expect(calls[0]!.init).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" });
  });

  it("does not insist on a write the browser could not send", async () => {
    const { fetchFn, calls } = fakeFetch([new TypeError("Failed to fetch"), new TypeError("Failed to fetch")]);
    const api = httpApi("https://api.example", fetchFn);
    await expect(settle(api.publish('{"address":"x","stamp":1}'))).rejects.toMatchObject({ status: 0 });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.init.body).toBe('{"address":"x","stamp":1}');
    expect((calls[0]!.init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("takes a payment the node already holds as delivered", async () => {
    const tx = new Uint8Array([1, 2, 3]);
    const twice = fakeFetch([json(422, { error: "already in mempool" })]);
    await settle(httpApi("https://api.example", twice.fetchFn).submit(tx, "ab", undefined));
    // The connection broke after the upload: the node says it has it.
    const lost = fakeFetch([new TypeError("Failed to fetch"), new TypeError("Failed to fetch"), json(200, { txid: "ab", status: "pending" })]);
    await settle(httpApi("https://api.example", lost.fetchFn).submit(tx, "ab", undefined));
    expect(lost.calls.map((c) => c.url)).toEqual([
      "https://api.example/transactions",
      "https://api.example/transactions",
      "https://api.example/transactions/ab",
    ]);
  });

  it("says when the node refuses a payment, without trying again", async () => {
    const { fetchFn, calls } = fakeFetch([json(422, { error: "spent nullifier" })]);
    const error = await settle(httpApi("https://api.example", fetchFn).submit(new Uint8Array([1]), "ab", undefined)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, message: "spent nullifier", refused: true });
    expect(calls).toHaveLength(1);
  });

  it("knows an unknown short address from a failure", async () => {
    const { fetchFn } = fakeFetch([json(404, { error: "unknown" }), json(200, { address: "zqfull" }), json(500, { error: "boom" })]);
    const api = httpApi("https://api.example", fetchFn);
    expect(await settle(api.resolve("zqshort"))).toBeNull();
    expect(await settle(api.resolve("zqshort"))).toBe("zqfull");
    await expect(settle(api.resolve("zqshort"))).rejects.toMatchObject({ status: 500, refused: false });
  });
});
