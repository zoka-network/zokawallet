import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CoreState, OpenWallet } from "../core/wallet-core";
import type { WalletClient } from "../worker/client";
import { App } from "./App";
import { WalletProvider } from "./context";

const PHRASE = Array.from({ length: 24 }, (_, i) => `word${i + 1}`).join(" ");

function openWallet(change: Partial<OpenWallet> = {}): OpenWallet {
  return {
    id: "a",
    name: "Main",
    address: "zqtest2" + "F".repeat(1700),
    short: "zqtest2short",
    published: true,
    publishing: false,
    height: 4437,
    tip: 4437,
    verified: 4414,
    inSync: true,
    spendable: 5_019_799_999_600,
    immature: 0,
    reserved: 0,
    maxSendable: 5_019_799_000_000,
    pending: null,
    unsent: null,
    history: [],
    ...change,
  };
}

function base(phase: CoreState["phase"], wallet: OpenWallet | null = null): CoreState {
  return {
    phase,
    wallets: wallet ? [{ id: wallet.id, name: wallet.name }] : [],
    wallet,
    sync: { state: "idle" },
    network: { height: 4437, hashrate: 959, checkpoint: 4414, targetSecs: 120, seen: 0 },
    busy: null,
  };
}

/** The Worker's side, played by the test. */
function fakeClient(initial: CoreState) {
  let state = initial;
  const listeners = new Set<(s: CoreState) => void>();
  const set = (next: CoreState) => {
    state = next;
    listeners.forEach((l) => l(next));
    return next;
  };
  const calls: string[] = [];
  const client: WalletClient = {
    current: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    fatal: () => null,
    init: async () => state,
    newPhrase: async () => PHRASE,
    validPhrase: async (p) => p === PHRASE,
    create: async (password, name, phrase) => {
      calls.push(`create:${password}:${name}:${phrase === PHRASE}`);
      return set(base("open", openWallet({ name: name || "Wallet" })));
    },
    unlock: async (password) => {
      calls.push(`unlock:${password}`);
      if (password !== "the right password") throw new Error("Wrong password");
      return set(base("open", openWallet()));
    },
    lock: async () => set(base("locked")),
    addWallet: async () => state,
    switchWallet: async () => state,
    renameWallet: async () => state,
    removeWallet: async () => state,
    forgetAll: async () => set(base("empty")),
    revealPhrase: async () => PHRASE,
    viewKey: async () => "zqview2key",
    changePassword: async () => undefined,
    resolve: async (text) => {
      if (!text.startsWith("zqtest2")) throw new Error("That is not a Zoka Quantic Testnet address");
      return { full: "zqtest2" + "B".repeat(1700), short: text };
    },
    quote: async (amount) => (amount > 10_000_000_000_000n ? { enough: false, reason: "not enough ZKA" } : { enough: true, fee_atoms: 100, inputs: 1 }),
    send: async () => ({ txid: "ab".repeat(32), amount_atoms: 1_500_000, fee_atoms: 100, expiry: 4457, delivered: true }),
    resubmit: async () => true,
    cancelUnsent: async () => state,
    qr: async () => new Uint8Array([21, ...new Array(441).fill(1)]),
    refresh: async () => undefined,
  };
  return { client, calls, set };
}

const section = (name: string) => within(screen.getByRole("navigation", { name: "Wallet sections" })).getByRole("button", { name });

function renderApp(state: CoreState) {
  const fake = fakeClient(state);
  render(
    <WalletProvider client={fake.client}>
      <App />
    </WalletProvider>,
  );
  return fake;
}

describe("the wallet's pages", () => {
  it("creates a wallet: words, three of them back, a password", async () => {
    const { calls } = renderApp(base("empty"));
    fireEvent.click(await screen.findByRole("button", { name: "Create a wallet" }));
    const words = await screen.findByRole("list", { name: "Recovery words" });
    expect(words.querySelectorAll("li")).toHaveLength(24);
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(next);

    const asked = await screen.findAllByLabelText(/^Word \d+$/);
    expect(asked).toHaveLength(3);
    const position = (input: HTMLElement) => Number(input.closest(".field")!.querySelector("label")!.textContent!.replace("Word ", ""));
    for (const input of asked) fireEvent.change(input, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("does not match");
    for (const input of asked) fireEvent.change(input, { target: { value: `word${position(input)}` } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(await screen.findByLabelText("Wallet name"), { target: { value: "Savings" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    expect(screen.getByText("At least 10 characters")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a long password" } });
    fireEvent.change(screen.getByLabelText("Repeat the password"), { target: { value: "a long password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create wallet" }));
    await screen.findByRole("navigation", { name: "Wallet sections" });
    expect(calls).toEqual(["create:a long password:Savings:true"]);
  });

  it("unlocks, and says so when the password is wrong", async () => {
    renderApp(base("locked"));
    const field = await screen.findByLabelText("Password");
    fireEvent.change(field, { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong password");
    fireEvent.change(field, { target: { value: "the right password" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("5,019,799.9996")).toBeInTheDocument();
  });

  it("shows the balance with what waits, and five sections", async () => {
    renderApp(base("open", openWallet({ reserved: 4_983_022_999_600, spendable: 36_776_999_800, pending: { txid: "cd".repeat(32), expiry: 4450 } })));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("5,019,799.9994");
    expect(screen.getByText(/in a payment waiting for a block/)).toBeInTheDocument();
    expect(screen.getByText("4,983,022.9996 ZKA")).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Wallet sections" });
    expect([...tabs.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Overview", "Send", "Receive", "Activity", "Settings"]);
    expect(section("Overview")).toHaveAttribute("aria-current", "page");
  });

  it("lists the latest payments on the overview and opens one", async () => {
    const history = [
      { txid: "11".repeat(32), height: 4430, timestamp: 1_762_000_000, kind: "received" as const, amount_atoms: 7_000_000, fee_atoms: 0, memo: "from the web", confirmations: 8 },
      { txid: "22".repeat(32), height: 4400, timestamp: 1_761_990_000, kind: "sent" as const, amount_atoms: 2_000_000, fee_atoms: 100, memo: "", confirmations: 38 },
    ];
    renderApp(base("open", openWallet({ history })));
    const payments = await screen.findByRole("list", { name: "Payments" });
    expect(within(payments).getAllByRole("button")).toHaveLength(2);
    fireEvent.click(within(payments).getByText("from the web"));
    const dialog = await screen.findByRole("dialog", { name: "Received" });
    expect(within(dialog).getByText("11".repeat(32))).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("changes wallets from the menu, and adds one from there", async () => {
    const fake = renderApp({ ...base("open", openWallet()), wallets: [{ id: "a", name: "Main" }, { id: "b", name: "Savings" }] });
    const switched: string[] = [];
    fake.client.switchWallet = async (id) => {
      switched.push(id);
      return fake.client.current()!;
    };
    fireEvent.click(await screen.findByRole("button", { name: "Wallet Main. Change wallet" }));
    const menu = screen.getByRole("menu", { name: "Wallets" });
    expect(within(menu).getByRole("menuitemradio", { name: "Main" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Savings" }));
    await waitFor(() => expect(switched).toEqual(["b"]));
    fireEvent.click(screen.getByRole("button", { name: "Wallet Main. Change wallet" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Add a wallet" }));
    expect(await screen.findByRole("dialog", { name: "Add a wallet" })).toBeInTheDocument();
    expect(section("Settings")).toHaveAttribute("aria-current", "page");
  });

  it("shows the recovery words in a window, after the password", async () => {
    renderApp(base("open", openWallet()));
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    fireEvent.click(within(screen.getByText("Recovery words").closest("li")!).getByRole("button", { name: "Show" }));
    const dialog = await screen.findByRole("dialog", { name: "Recovery words" });
    fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "the right password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Show the words" }));
    expect((await within(dialog).findByRole("list", { name: "Recovery words" })).querySelectorAll("li")).toHaveLength(24);
  });

  it("checks a payment before proving it", async () => {
    renderApp(base("open", openWallet()));
    await screen.findByRole("navigation", { name: "Wallet sections" });
    fireEvent.click(section("Send"));
    const to = screen.getByLabelText("To");
    const amount = screen.getByLabelText("Amount");
    fireEvent.change(to, { target: { value: "nonsense" } });
    fireEvent.change(amount, { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("That is not a Zoka Quantic Testnet address")).toBeInTheDocument();

    fireEvent.change(to, { target: { value: "zqtest2bob" } });
    fireEvent.change(amount, { target: { value: "1.0000001" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("ZKA has 6 decimals at most")).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("Total")).toBeInTheDocument();
    expect(screen.getByText("1.5001 ZKA")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send 1.50 ZKA" }));
    expect(await screen.findByText("Payment sent")).toBeInTheDocument();
    expect(screen.getByText("ab".repeat(32))).toBeInTheDocument();
  });

  it("will not start a payment while the last one waits", async () => {
    renderApp(base("open", openWallet({ pending: { txid: "cd".repeat(32), expiry: 4450 } })));
    await screen.findByRole("navigation", { name: "Wallet sections" });
    fireEvent.click(section("Send"));
    expect(screen.getByRole("status")).toHaveTextContent("waiting for a block");
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
  });

  it("shares the short address with its QR, and the full one on request", async () => {
    renderApp(base("open", openWallet()));
    await screen.findByRole("navigation", { name: "Wallet sections" });
    fireEvent.click(section("Receive"));
    expect(await screen.findByRole("img", { name: "QR code of your short address" })).toBeInTheDocument();
    expect(screen.getByText("zqtest2short")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Full address/ }));
    expect(screen.getByRole("button", { name: "Copy full address" })).toBeInTheDocument();
  });

  it("locks from Settings", async () => {
    const fake = renderApp(base("open", openWallet()));
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lock now" }));
    });
    await waitFor(() => expect(fake.client.current()?.phase).toBe("locked"));
    expect(await screen.findByRole("button", { name: "Unlock" })).toBeInTheDocument();
  });
});
