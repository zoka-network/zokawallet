// @vitest-environment node
// The wallet's core with the real WebAssembly, a fake IndexedDB and a fake
// node: what is kept, what is sealed, and what the node is told.
import { IDBFactory } from "fake-indexeddb";
import { fixture, fixtureText, loadWasm } from "../test/wasm";
import type { Api, NodeStatus } from "./api";
import { ApiError } from "./api";
import { VaultStore } from "./vault";
import { WalletCore, type CoreState } from "./wallet-core";

const wasm = loadWasm();
const PASSWORD = "correct horse battery";

function status(height: number, checkpoint: number | null = null): NodeStatus {
  return {
    chain_id: "zoka-quantic-testnet-v2",
    height,
    hash: "00".repeat(32),
    tip_timestamp: 0,
    hashrate_estimate_hps: 900,
    target_block_secs: 120,
    node_version: "4.0.6",
    checkpoint: checkpoint ? { height: checkpoint, block_hash: "00".repeat(32) } : null,
  };
}

class FakeNode implements Api {
  height = 0;
  pages = new Map<number, Uint8Array>();
  checkpointJson = "null";
  directory = new Map<string, string>();
  published: string[] = [];
  submitted: Uint8Array[] = [];
  refuse: string | null = null;
  calls: string[] = [];

  async status() {
    this.calls.push("status");
    return status(this.height);
  }
  async scan2(from: number) {
    this.calls.push(`scan2:${from}`);
    const page = this.pages.get(from);
    if (!page) throw new ApiError(404, "no such page");
    return page;
  }
  async checkpoint() {
    this.calls.push("checkpoint");
    return this.checkpointJson;
  }
  async resolve(short: string) {
    this.calls.push(`resolve:${short}`);
    return this.directory.get(short) ?? null;
  }
  async transaction() {
    return null;
  }
  async submit(tx: Uint8Array) {
    if (this.refuse) throw new ApiError(422, this.refuse);
    this.submitted.push(tx);
  }
  async publish(record: string) {
    this.published.push(record);
  }
}

async function setup(node = new FakeNode(), factory = new IDBFactory()) {
  const store = await VaultStore.open(factory);
  const states: CoreState[] = [];
  const core = new WalletCore({ wasm, api: node, store, emit: (state) => states.push(state) });
  await core.init();
  return { core, node, store, states, factory };
}

async function until(check: () => boolean, ms = 30_000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Every byte the browser keeps, as text, to look for secrets in it. */
async function dump(store: VaultStore): Promise<string> {
  const parts: unknown[] = [await store.header(), await store.active(), await store.wallets(), await store.states()];
  return JSON.stringify(parts, (_key, value) =>
    value instanceof Uint8Array ? new TextDecoder("latin1").decode(value) : value,
  );
}

describe("the wallet core", () => {
  it("derives both view keys automatically, keeps them local and refuses them while locked", async () => {
    const { core, store, node, states } = await setup();
    const phrase = core.newPhrase();
    await core.create(PASSWORD, "Main", phrase);
    const incoming = core.incomingViewKey();
    const full = core.viewKey();
    expect(incoming).toMatch(/^zqtestviewin2/);
    expect(full).toMatch(/^zqtestview2/);
    expect(incoming).not.toBe(full);
    expect(JSON.stringify(states)).not.toContain(incoming);
    expect(JSON.stringify(states)).not.toContain(full);
    expect(JSON.stringify(node.calls)).not.toContain(incoming);
    expect(await dump(store)).not.toContain(incoming);
    core.lock();
    expect(() => core.incomingViewKey()).toThrow();
    expect(() => core.viewKey()).toThrow();
    await core.unlock(PASSWORD);
    expect(core.incomingViewKey()).toBe(incoming);
    expect(core.viewKey()).toBe(full);
    core.lock();
  });

  it("creates a wallet whose words and name never reach the storage in the clear", async () => {
    const { core, store } = await setup();
    const phrase = core.newPhrase();
    expect(phrase.split(" ")).toHaveLength(24);
    const state = await core.create(PASSWORD, "Savings", phrase);
    expect(state.phase).toBe("open");
    expect(state.wallets).toEqual([{ id: expect.any(String), name: "Savings" }]);
    const wallet = state.wallet!;
    expect(wasm.addressKind(wallet.address, 2)).toBe("full");
    expect(wasm.addressKind(wallet.short, 2)).toBe("short");
    expect(wasm.matchesShort(wallet.address, wallet.short, 2)).toBe(true);

    // Single words may be field names too ("secret", "state"): look for the
    // phrase and every pair of words in it.
    const kept = await dump(store);
    const words = phrase.split(" ");
    expect(kept).not.toContain(phrase);
    for (let i = 1; i < words.length; i++) expect(kept).not.toContain(`${words[i - 1]} ${words[i]}`);
    expect(kept).not.toContain("Savings");
    core.lock();
  });

  it("unlocks with the password only, and a wrong one changes nothing", async () => {
    const { core, factory, states } = await setup();
    const phrase = core.newPhrase();
    const created = await core.create(PASSWORD, "Main", phrase);
    expect(core.lock().phase).toBe("locked");
    await expect(core.unlock("not the password")).rejects.toThrow("Wrong password");
    // The page hears that the attempt ended (it was stuck on "Opening").
    expect(states.at(-1)).toMatchObject({ phase: "locked", busy: null });
    const again = await core.unlock(PASSWORD);
    expect(again.wallet!.address).toBe(created.wallet!.address);
    expect(await core.revealPhrase(PASSWORD)).toBe(phrase);
    await expect(core.revealPhrase("wrong password!")).rejects.toThrow("Wrong password");
    core.lock();

    // Another tab, the same storage: it starts locked.
    const other = await setup(new FakeNode(), factory);
    expect(other.core.snapshot().phase).toBe("locked");
  });

  it("refuses short passwords and bad words", async () => {
    const { core, states } = await setup();
    await expect(core.create("short", "Main", core.newPhrase())).rejects.toThrow("10 characters");
    await expect(core.create(PASSWORD, "Main", "abandon abandon abandon")).rejects.toThrow("24 valid");
    expect(states.at(-1)).toMatchObject({ phase: "empty", busy: null });
  });

  it("reads real testnet pages, keeps them sealed and resumes from them", async () => {
    const node = new FakeNode();
    node.height = 3;
    node.pages.set(1, fixture("scan2-from1-count3.bin"));
    node.checkpointJson = fixtureText("checkpoint.json");
    const { core, states, factory } = await setup(node);
    const phrase = core.newPhrase();
    await core.create(PASSWORD, "Main", phrase);
    await until(() => states.at(-1)?.wallet?.height === 3 && states.at(-1)?.sync.state === "idle");
    const read = core.snapshot().wallet!;
    expect(read).toMatchObject({ height: 3, tip: 3, inSync: true, spendable: 0 });
    // The real checkpoint is past block 3: kept for later, not trusted yet.
    expect(read.verified).toBe(0);
    expect(node.calls).toContain("checkpoint");
    await until(() => states.at(-1)?.wallet?.publishing === false && node.published.length === 1);
    core.lock();

    // Opened again: block 4 is the next one asked for.
    const later = new FakeNode();
    later.height = 3;
    later.directory = new Map(node.published.map((r) => [wasm.shortOf(JSON.parse(r).address, 2), JSON.parse(r).address]));
    const second = await setup(later, factory);
    await second.core.unlock(PASSWORD);
    await until(() => later.calls.includes("checkpoint"));
    expect(later.calls.filter((c) => c.startsWith("scan2"))).toEqual([]);
    expect(second.core.snapshot().wallet!.height).toBe(3);
    second.core.lock();
  });

  it("publishes its short address with a stamp found here, and only once", async () => {
    const { core, node, states } = await setup();
    const state = await core.create(PASSWORD, "Main", core.newPhrase());
    const short = state.wallet!.short;
    await until(() => node.published.length === 1 && states.at(-1)?.wallet?.published === true);
    const record = node.published[0]!;
    // The stamp is a u64: it travels as the WebAssembly wrote it, not as a
    // JavaScript number that would round it.
    expect(record).toMatch(/^\{"address":"[A-Za-z0-9]+","stamp":\d+\}$/);
    expect(wasm.shortOf(JSON.parse(record).address, 2)).toBe(short);
    core.refresh();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(node.published).toHaveLength(1);
    core.lock();
  });

  it("does not stamp an address a node already knows", async () => {
    const node = new FakeNode();
    const phrase = loadWasm().newPhrase();
    const probe = new wasm.WebWallet(phrase, 2, new Uint8Array());
    node.directory.set(probe.shortAddress(), probe.address());
    probe.free();
    const { core, states } = await setup(node);
    await core.create(PASSWORD, "Main", phrase);
    await until(() => states.at(-1)?.wallet?.published === true);
    expect(node.published).toEqual([]);
    core.lock();
  });

  it("keeps several wallets, refuses the same one twice and forgets them", async () => {
    const { core, store } = await setup();
    const first = core.newPhrase();
    const second = core.newPhrase();
    const a = (await core.create(PASSWORD, "Main", first)).wallet!;
    const b = (await core.addWallet("Savings", second)).wallet!;
    expect(b.address).not.toBe(a.address);
    expect(core.snapshot().wallets.map((w) => w.name)).toEqual(["Main", "Savings"]);
    await expect(core.addWallet("Again", first.toUpperCase())).rejects.toThrow("already in this browser");

    const back = await core.switchWallet(a.id);
    expect(back.wallet!.address).toBe(a.address);
    await core.renameWallet(b.id, "  Rainy   day ");
    expect(core.snapshot().wallets.map((w) => w.name)).toEqual(["Main", "Rainy day"]);

    // Locked and opened again: the last one used comes back.
    await core.switchWallet(b.id);
    core.lock();
    expect((await core.unlock(PASSWORD)).wallet!.address).toBe(b.address);

    const left = await core.removeWallet(b.id);
    expect(left.wallets.map((w) => w.name)).toEqual(["Main"]);
    expect(left.wallet!.address).toBe(a.address);
    await expect(core.removeWallet(a.id)).rejects.toThrow("only wallet");

    expect((await core.forgetAll()).phase).toBe("empty");
    expect(await store.header()).toBeUndefined();
    expect(await store.wallets()).toEqual([]);
  });

  it("changes the password by sealing everything again", async () => {
    const { core } = await setup();
    const phrase = core.newPhrase();
    await core.create(PASSWORD, "Main", phrase);
    await core.addWallet("Two", core.newPhrase());
    await expect(core.changePassword("wrong password!", "a new password")).rejects.toThrow("Wrong password");
    await core.changePassword(PASSWORD, "a new password");
    core.lock();
    await expect(core.unlock(PASSWORD)).rejects.toThrow("Wrong password");
    const opened = await core.unlock("a new password");
    expect(opened.wallets).toHaveLength(2);
    await core.switchWallet(opened.wallets[0]!.id);
    expect(await core.revealPhrase("a new password")).toBe(phrase);
    core.lock();
  });

  it("refuses sealed blobs moved between wallets", async () => {
    const { core, store, factory } = await setup();
    await core.create(PASSWORD, "Main", core.newPhrase());
    await core.addWallet("Two", core.newPhrase());
    core.lock();
    const [one, two] = await store.wallets();
    await store.write({ wallets: [{ ...one!, secret: two!.secret }] });
    const other = await setup(new FakeNode(), factory);
    await expect(other.core.unlock(PASSWORD)).rejects.toThrow("damaged");
  });

  it("checks the full address a node gives for a short one", async () => {
    const node = new FakeNode();
    const { core } = await setup(node);
    await core.create(PASSWORD, "Main", core.newPhrase());
    const bob = new wasm.WebWallet(wasm.newPhrase(), 2, new Uint8Array());
    const eve = new wasm.WebWallet(wasm.newPhrase(), 2, new Uint8Array());
    const short = bob.shortAddress();

    await expect(core.resolve(short)).rejects.toThrow("Nobody has published");
    node.directory.set(short, eve.address());
    await expect(core.resolve(short)).rejects.toThrow("does not match");
    node.directory.set(short, bob.address());
    expect(await core.resolve(`zoka:${short}?amount=2.5`)).toEqual({ full: bob.address(), short, amount: "2.5" });
    expect(await core.resolve(bob.address())).toEqual({ full: bob.address(), short });
    await expect(core.resolve("zqtest2nothing")).rejects.toThrow("not a Zoka Quantic Testnet address");
    bob.free();
    eve.free();
    core.lock();
  });

  it("says why an empty wallet cannot pay", async () => {
    const { core } = await setup();
    await core.create(PASSWORD, "Main", core.newPhrase());
    const bob = new wasm.WebWallet(wasm.newPhrase(), 2, new Uint8Array());
    expect(core.quote(1_000_000n).enough).toBe(false);
    await expect(core.send(bob.address(), 1_000_000n, "")).rejects.toThrow();
    await expect(core.send(bob.shortAddress(), 1_000_000n, "")).rejects.toThrow("full address");
    await expect(core.send(bob.address(), 1_000_000n, "x".repeat(513))).rejects.toThrow("512 bytes");
    bob.free();
    core.lock();
  });
});
