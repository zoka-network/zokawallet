import { useState } from "react";
import { formatZka } from "../lib/amount";
import { formatHashrate, plural } from "./format";
import { Icon, Sheet } from "./components";
import { useWallet } from "./context";

// The wallet tab: the balance and little else. Activity has its own tab.

function fitSize(text: string): number {
  // Big for short balances, smaller as the digits grow, so it stays on a line.
  if (text.length <= 8) return 46;
  if (text.length <= 12) return 40;
  if (text.length <= 15) return 34;
  return 28;
}

export function Home({ onWallets }: { onWallets: () => void }) {
  const { client, state } = useWallet();
  const [network, setNetwork] = useState(false);
  const wallet = state?.wallet;
  if (!state || !wallet) return null;
  const total = BigInt(wallet.spendable) + BigInt(wallet.immature) + BigInt(wallet.reserved);
  const text = formatZka(total);
  const syncing = state.sync.state === "syncing" || !wallet.inSync;
  const offline = state.sync.state === "offline";

  return (
    <div className="screen">
      <div className="top">
        <div className="brand">
          <span className="brand-name">ZOKA</span>
          <span className="brand-net">Quantic Testnet</span>
        </div>
        <button type="button" className="chip" onClick={onWallets} aria-label={`Wallet ${wallet.name}. Change wallet`}>
          <span>{wallet.name}</span>
          <Icon name="down" />
        </button>
      </div>

      <section className="balance" aria-label="Balance">
        <p className="label">Balance</p>
        <p className="balance-value" style={{ fontSize: fitSize(text) }}>
          {text}
          <span className="balance-unit">ZKA</span>
        </p>
        {wallet.reserved > 0 && (
          <p className="balance-note">
            <strong>{formatZka(wallet.reserved)} ZKA</strong> in a payment waiting for a block
          </p>
        )}
        {wallet.immature > 0 && <p className="balance-note">{formatZka(wallet.immature)} ZKA mined, maturing</p>}
        <button type="button" className="sync" onClick={() => setNetwork(true)} style={{ width: "100%" }}>
          <span className={`dot${offline ? " off" : syncing ? " busy" : ""}`} />
          {offline
            ? "Offline · trying again"
            : syncing
              ? `Reading the chain · ${wallet.height.toLocaleString("en")} of ${wallet.tip.toLocaleString("en")}`
              : `Up to date · block ${wallet.height.toLocaleString("en")}`}
        </button>
      </section>

      <div className="stack mt">
        {wallet.unsent && (
          <div className="strip" role="alert">
            <Icon name="alert" />
            <div className="grow">
              <p>A payment was proved but has not reached the network.</p>
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn small" onClick={() => void client.resubmit()}>
                  Send again
                </button>
                <button type="button" className="btn small danger" onClick={() => void client.cancelUnsent()}>
                  Cancel it
                </button>
              </div>
            </div>
          </div>
        )}
        {wallet.pending && !wallet.unsent && (
          <div className="strip pink">
            <Icon name="clock" />
            <p className="grow">
              Your last payment is waiting for a block. The rest of the balance can be sent once it is mined.
            </p>
          </div>
        )}
        {!wallet.published && (
          <div className="strip pink">
            <Icon name="light" />
            <p className="grow">
              {wallet.publishing
                ? "Activating your short address. This takes a few seconds."
                : "Your short address activates once the network answers."}
            </p>
          </div>
        )}
      </div>

      {network && (
        <Sheet title="Network" onClose={() => setNetwork(false)}>
          <div className="facts">
            <div>
              <p className="label">Chain tip</p>
              <p className="fact-value">#{wallet.tip.toLocaleString("en")}</p>
            </div>
            <div>
              <p className="label">This wallet read</p>
              <p className="fact-value">#{wallet.height.toLocaleString("en")}</p>
            </div>
            <div>
              <p className="label">Signed checkpoint</p>
              <p className="fact-value">{wallet.verified ? `#${wallet.verified.toLocaleString("en")}` : "Not yet"}</p>
            </div>
            <div>
              <p className="label">Network hashrate</p>
              <p className="fact-value">{state.network ? formatHashrate(state.network.hashrate) : "—"}</p>
            </div>
          </div>
          <p className="hint">
            Each page of the chain is checked against its block header here, and what was read is checked against the
            latest checkpoint the Zoka team signed (Ed25519 and ML-DSA-65).
            {wallet.verified > 0 && wallet.height > wallet.verified
              ? ` ${plural(wallet.height - wallet.verified, "block")} after it are checked by their work only.`
              : ""}
          </p>
          {offline && state.sync.error && <p className="error">{state.sync.error}</p>}
        </Sheet>
      )}
    </div>
  );
}
