import { useState } from "react";
import type { Movement } from "../core/wallet-core";
import { formatZka } from "../lib/amount";
import { MovementDialog, MovementList } from "./Activity";
import type { Tab } from "./App";
import { CopyButton, Icon, PageHead, Panel, Qr } from "./components";
import { useWallet } from "./context";
import { formatHashrate, plural } from "./format";

// The overview: the balance and what it is made of, the latest payments, the
// address to receive and what this browser checked of the chain.

const RECENT = 6;

export function Overview({ go }: { go: (tab: Tab) => void }) {
  const { client, state } = useWallet();
  const [open, setOpen] = useState<Movement | null>(null);
  const wallet = state?.wallet;
  if (!state || !wallet) return null;
  const total = BigInt(wallet.spendable) + BigInt(wallet.immature) + BigInt(wallet.reserved);
  const syncing = state.sync.state === "syncing" || !wallet.inSync;
  const offline = state.sync.state === "offline";
  const recent = wallet.history.slice(0, RECENT);

  return (
    <>
      <PageHead eyebrow={`${wallet.name} · Total balance`}>
        <h1 className="balance">
          {formatZka(total)}
          <span className="unit">ZKA</span>
        </h1>
        <div className="status-line">
          <span className={`dot${offline ? " off" : syncing ? " busy" : ""}`} />
          <span>
            {offline
              ? "Offline · trying again"
              : syncing
                ? `Reading the chain · ${wallet.height.toLocaleString("en")} of ${wallet.tip.toLocaleString("en")}`
                : "Up to date"}
          </span>
          <span>Block {wallet.height.toLocaleString("en")}</span>
          <span>{wallet.verified ? `Checkpoint #${wallet.verified.toLocaleString("en")}` : "Checkpoint pending"}</span>
        </div>
        <div className="page-actions">
          <button type="button" className="btn primary wide" onClick={() => go("send")}>
            <Icon name="send" />
            Send
          </button>
          <button type="button" className="btn wide" onClick={() => go("receive")}>
            <Icon name="receive" />
            Receive
          </button>
        </div>
      </PageHead>

      {(wallet.unsent || wallet.pending || !wallet.published) && (
        <div className="banners">
          {wallet.unsent && (
            <div className="banner amber" role="alert">
              <Icon name="alert" />
              <div className="grow">
                <p>A payment was proved but has not reached the network.</p>
                <div className="row">
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
            <div className="banner">
              <Icon name="clock" />
              <p className="grow">Your last payment is waiting for a block. The rest of the balance can be sent once it is mined.</p>
            </div>
          )}
          {!wallet.published && (
            <div className="banner">
              <Icon name="light" />
              <p className="grow">
                {wallet.publishing
                  ? "Activating your short address. This takes a few seconds."
                  : "Your short address activates once the network answers. Until then, share the full address."}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="stats money block-gap">
        <div className="stat">
          <p className="label">Available</p>
          <p className="stat-value">{formatZka(wallet.spendable)} ZKA</p>
          <p className="stat-hint">Ready to send</p>
        </div>
        <div className="stat">
          <p className="label">Waiting for a block</p>
          <p className={`stat-value${wallet.reserved > 0 ? " amber" : ""}`}>{formatZka(wallet.reserved)} ZKA</p>
          <p className="stat-hint">{wallet.reserved > 0 ? "Held in a payment waiting for a block" : "No payment pending"}</p>
        </div>
        <div className="stat">
          <p className="label">Maturing</p>
          <p className="stat-value">{formatZka(wallet.immature)} ZKA</p>
          <p className="stat-hint">Mined, not spendable yet</p>
        </div>
        <div className="stat">
          <p className="label">Max in one payment</p>
          <p className="stat-value">{formatZka(wallet.maxSendable)} ZKA</p>
          <p className="stat-hint">After the network fee</p>
        </div>
      </div>

      <div className="overview-grid">
        <Panel
          title="Recent activity"
          action={
            wallet.history.length > 0 ? (
              <button type="button" className="link" onClick={() => go("activity")}>
                All activity →
              </button>
            ) : undefined
          }
        >
          {recent.length === 0 ? (
            <p className="empty">{wallet.inSync ? "No payments yet. Share your address to receive ZKA." : "Reading the chain… payments appear here."}</p>
          ) : (
            <MovementList items={recent} compact onOpen={setOpen} />
          )}
        </Panel>

        <Panel
          title="Receive"
          action={
            <button type="button" className="link" onClick={() => go("receive")}>
              Details →
            </button>
          }
        >
          <div className="panel-body receive-mini">
            {wallet.published ? (
              <>
                <Qr text={wallet.short} label="QR code of the short address" />
                <p className="mono">{wallet.short}</p>
                <CopyButton text={wallet.short} label="Copy address" small />
              </>
            ) : (
              <>
                <p className="hint center">The short address and its QR appear here once it is active. The full address works already.</p>
                <CopyButton text={wallet.address} label="Copy full address" small />
              </>
            )}
          </div>
        </Panel>
      </div>

      <h2 className="heading section-gap section-title">Network</h2>
      <div className="stats">
        <div className="stat">
          <p className="label">Chain tip</p>
          <p className="stat-value">#{wallet.tip.toLocaleString("en")}</p>
          <p className="stat-hint">The latest block the node knows</p>
        </div>
        <div className="stat">
          <p className="label">Read here</p>
          <p className="stat-value">#{wallet.height.toLocaleString("en")}</p>
          <p className="stat-hint">Each page checked against its block header</p>
        </div>
        <div className="stat">
          <p className="label">Signed checkpoint</p>
          <p className="stat-value">{wallet.verified ? `#${wallet.verified.toLocaleString("en")}` : "Not yet"}</p>
          <p className="stat-hint">Ed25519 + ML-DSA-65, by the Zoka team</p>
        </div>
        <div className="stat">
          <p className="label">Network hashrate</p>
          <p className="stat-value">{state.network ? formatHashrate(state.network.hashrate) : "—"}</p>
          <p className="stat-hint">Estimated from the difficulty</p>
        </div>
      </div>
      <p className="note" style={{ marginTop: 18 }}>
        What this browser read is checked against the latest checkpoint the Zoka team signed.
        {wallet.verified > 0 && wallet.height > wallet.verified
          ? ` The ${plural(wallet.height - wallet.verified, "block")} after it are checked by their work only.`
          : ""}
        {offline && state.sync.error ? ` Last error: ${state.sync.error}` : ""}
      </p>

      {open && <MovementDialog movement={open} onClose={() => setOpen(null)} />}
    </>
  );
}
