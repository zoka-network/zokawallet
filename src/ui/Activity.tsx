import { useState } from "react";
import { EXPLORER } from "../config";
import type { Movement } from "../core/wallet-core";
import { formatZka } from "../lib/amount";
import { CopyButton, Header, Icon, Sheet } from "./components";
import { useWallet } from "./context";
import { dateTime, timeAgo } from "./format";

const titles: Record<Movement["kind"], string> = { received: "Received", sent: "Sent", mined: "Mined" };

export function Activity() {
  const { state } = useWallet();
  const [open, setOpen] = useState<Movement | null>(null);
  const wallet = state?.wallet;
  if (!wallet) return null;
  const history = wallet.history;
  return (
    <div className="screen">
      <Header title="Activity" />
      {history.length === 0 ? (
        <div className="working">
          <span className="item-icon" style={{ width: 56, height: 56 }}>
            <Icon name="activity" />
          </span>
          <p className="muted">{wallet.inSync ? "No payments yet." : "Reading the chain… payments appear here."}</p>
        </div>
      ) : (
        <ul className="list mt" aria-label="Payments">
          {history.map((m) => (
            <li key={`${m.txid}-${m.kind}`}>
              <button type="button" className="item" onClick={() => setOpen(m)}>
                <span className={`item-icon ${m.kind === "sent" ? "out" : "in"}`}>
                  <Icon name={m.kind === "sent" ? "send" : m.kind === "mined" ? "mined" : "receive"} />
                </span>
                <span className="grow">
                  <span className="item-title" style={{ display: "block" }}>
                    {titles[m.kind]}
                    {m.memo ? ` · ${m.memo}` : ""}
                  </span>
                  <span className="item-sub" style={{ display: "block" }}>
                    {timeAgo(m.timestamp)}
                    {m.confirmations < 10 ? ` · ${m.confirmations} confirmation${m.confirmations === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
                <span className={`item-amount${m.kind === "sent" ? "" : " in"}`}>
                  {m.kind === "sent" ? "−" : "+"}
                  {formatZka(m.amount_atoms)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <Sheet title={titles[open.kind]} onClose={() => setOpen(null)}>
          <p className="balance-value" style={{ fontSize: 30, marginTop: 0 }}>
            {open.kind === "sent" ? "−" : "+"}
            {formatZka(open.amount_atoms)}
            <span className="balance-unit">ZKA</span>
          </p>
          <div className="facts">
            <div>
              <p className="label">Block</p>
              <p className="fact-value">#{open.height.toLocaleString("en")}</p>
            </div>
            <div>
              <p className="label">Confirmations</p>
              <p className="fact-value">{open.confirmations.toLocaleString("en")}</p>
            </div>
            <div>
              <p className="label">Time</p>
              <p className="fact-value">{dateTime(open.timestamp)}</p>
            </div>
            {open.kind === "sent" && (
              <div>
                <p className="label">Network fee</p>
                <p className="fact-value">{formatZka(open.fee_atoms)} ZKA</p>
              </div>
            )}
          </div>
          {open.memo && (
            <div>
              <p className="label">Note</p>
              <p style={{ marginTop: 4, overflowWrap: "anywhere" }}>{open.memo}</p>
            </div>
          )}
          <div>
            <p className="label">Payment id</p>
            <p className="mono" style={{ marginTop: 4 }}>
              {open.txid}
            </p>
          </div>
          <div className="row">
            <CopyButton text={open.txid} small />
            <a className="btn small" href={`${EXPLORER}/search/${open.txid}`} target="_blank" rel="noreferrer noopener">
              View on ZokaScan
            </a>
          </div>
        </Sheet>
      )}
    </div>
  );
}
