import { useState } from "react";
import { EXPLORER } from "../config";
import type { Movement } from "../core/wallet-core";
import { formatZka } from "../lib/amount";
import { CopyButton, Dialog, Icon, PageHead, Panel } from "./components";
import { useWallet } from "./context";
import { dateTime, plural, timeAgo } from "./format";

const titles: Record<Movement["kind"], string> = { received: "Received", sent: "Sent", mined: "Mined" };

/** The payments as a table on a desktop and as two-line rows on a phone. */
export function MovementList({ items, compact = false, onOpen }: { items: Movement[]; compact?: boolean; onOpen: (m: Movement) => void }) {
  return (
    <div className={compact ? "compact" : undefined}>
      <div className="mv-head" aria-hidden="true">
        <span>Type</span>
        <span>Note</span>
        <span className="mv-block">Block</span>
        <span>When</span>
        <span style={{ textAlign: "right" }}>Amount</span>
      </div>
      <ul className="mv-list" aria-label="Payments">
        {items.map((m) => {
          const out = m.kind === "sent";
          return (
            <li key={`${m.txid}-${m.kind}`}>
              <button type="button" className="mv-row" onClick={() => onOpen(m)}>
                <span className={`mv-type${out ? " out" : ""}`}>
                  <Icon name={out ? "send" : m.kind === "mined" ? "mined" : "receive"} />
                  {titles[m.kind]}
                  {m.confirmations < 10 && <span className="chip amber">{m.confirmations} conf.</span>}
                </span>
                <span className="mv-note">{m.memo || "—"}</span>
                <span className="mv-block">#{m.height.toLocaleString("en")}</span>
                <span className="mv-when">{timeAgo(m.timestamp)}</span>
                <span className={`mv-amount${out ? " out" : ""}`}>
                  {out ? "−" : "+"}
                  {formatZka(m.amount_atoms)} ZKA
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MovementDialog({ movement, onClose }: { movement: Movement; onClose: () => void }) {
  const out = movement.kind === "sent";
  return (
    <Dialog title={titles[movement.kind]} onClose={onClose}>
      <p className={`amount-big${out ? "" : " in"}`}>
        {out ? "−" : "+"}
        {formatZka(movement.amount_atoms)}
        <span className="unit" style={{ fontSize: 13, verticalAlign: "middle" }}>
          ZKA
        </span>
      </p>
      <dl className="facts flush">
        <dt>Block</dt>
        <dd>#{movement.height.toLocaleString("en")}</dd>
        <dt>Confirmations</dt>
        <dd>{movement.confirmations.toLocaleString("en")}</dd>
        <dt>Time</dt>
        <dd>{dateTime(movement.timestamp)}</dd>
        {out && (
          <>
            <dt>Network fee</dt>
            <dd>{formatZka(movement.fee_atoms)} ZKA</dd>
          </>
        )}
        {movement.memo && (
          <>
            <dt>Note</dt>
            <dd>{movement.memo}</dd>
          </>
        )}
        <dt>Payment id</dt>
        <dd className="mono">{movement.txid}</dd>
      </dl>
      <div className="actions start">
        <CopyButton text={movement.txid} label="Copy id" small />
        <a className="btn small" href={`${EXPLORER}/search/${movement.txid}`} target="_blank" rel="noreferrer noopener">
          View on ZokaScan
          <Icon name="external" />
        </a>
      </div>
    </Dialog>
  );
}

export function Activity() {
  const { state } = useWallet();
  const [open, setOpen] = useState<Movement | null>(null);
  const wallet = state?.wallet;
  if (!wallet) return null;
  const history = wallet.history;
  const received = history.filter((m) => m.kind !== "sent").length;
  return (
    <>
      <PageHead
        eyebrow={`${wallet.name} · Activity`}
        title="Activity"
        lede="Payments this wallet sent and received, read from the chain in this browser. Only you and the other side of each payment can see its amount and note."
      />
      <Panel
        className="block-gap"
        title={history.length ? `${plural(history.length, "payment")} · ${received} in, ${history.length - received} out` : "Payments"}
        action={
          <a className="link" href={EXPLORER} target="_blank" rel="noreferrer noopener">
            ZokaScan ↗
          </a>
        }
      >
        {history.length === 0 ? (
          <p className="empty">{wallet.inSync ? "No payments yet." : "Reading the chain… payments appear here."}</p>
        ) : (
          <MovementList items={history} onOpen={setOpen} />
        )}
      </Panel>
      {open && <MovementDialog movement={open} onClose={() => setOpen(null)} />}
    </>
  );
}
