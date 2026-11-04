import { useCallback, useState } from "react";
import { EXPLORER, MEMO_BYTES } from "../config";
import type { Recipient, Sent } from "../core/wallet-core";
import { AmountError, atomsToInput, formatZka, memoBytes, parseZka } from "../lib/amount";
import { middle, parsePaymentText } from "../lib/payment";
import { CopyButton, Field, Header, Icon, Working, useElapsed } from "./components";
import { useWallet } from "./context";
import { Scanner, canScan } from "./Scanner";

type Step =
  | { step: "form" }
  | { step: "review"; recipient: Recipient; amount: bigint; fee: bigint; memo: string }
  | { step: "working" }
  | { step: "done"; sent: Sent }
  | { step: "failed"; error: string };

export function Send({ initial, onDone }: { initial?: string; onDone: () => void }) {
  const { client, state } = useWallet();
  const [flow, setFlow] = useState<Step>({ step: "form" });
  const prefill = initial ? parsePaymentText(initial) : null;
  const [to, setTo] = useState(prefill?.address ?? "");
  const [amount, setAmount] = useState(prefill?.amount ?? "");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<{ field: "to" | "amount" | "memo" | "form"; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const wallet = state?.wallet;

  const onScanned = useCallback((text: string) => {
    setScanning(false);
    const read = parsePaymentText(text);
    setTo(read.address);
    if (read.amount) setAmount(read.amount);
    setError(null);
  }, []);

  if (!wallet) return null;

  const review = async () => {
    setError(null);
    let atoms: bigint;
    try {
      atoms = parseZka(amount);
    } catch (e) {
      setError({ field: "amount", text: e instanceof AmountError ? e.message : "That is not an amount" });
      return;
    }
    if (memoBytes(memo) > MEMO_BYTES) {
      setError({ field: "memo", text: `The note can have ${MEMO_BYTES} bytes at most` });
      return;
    }
    setChecking(true);
    try {
      const recipient = await client.resolve(to).catch((e: Error) => {
        setError({ field: "to", text: e.message });
        return null;
      });
      if (!recipient) return;
      const quote = await client.quote(atoms);
      if (!quote.enough) {
        setError({ field: "amount", text: quote.reason ?? "Not enough ZKA for this payment" });
        return;
      }
      setFlow({ step: "review", recipient, amount: atoms, fee: BigInt(quote.fee_atoms ?? 0), memo });
    } finally {
      setChecking(false);
    }
  };

  const send = (target: Extract<Step, { step: "review" }>) => {
    setFlow({ step: "working" });
    client.send(target.recipient.full, target.amount, target.memo).then(
      (sent) => setFlow({ step: "done", sent }),
      (e: Error) => setFlow({ step: "failed", error: e.message }),
    );
  };

  if (flow.step === "working") return <SendWorking />;

  if (flow.step === "done") {
    const { sent } = flow;
    return (
      <div className="screen">
        <div className="working">
          <span className="done-mark">
            <Icon name={sent.delivered ? "check" : "alert"} />
          </span>
          <p className="title">{sent.delivered ? "Payment sent" : "Proved, not delivered"}</p>
          <p className="balance-value" style={{ fontSize: 30 }}>
            {formatZka(sent.amount_atoms)}
            <span className="balance-unit">ZKA</span>
          </p>
          <p className="muted">
            {sent.delivered
              ? "It joins the chain with the next block, usually within a few minutes."
              : "The network could not be reached. Send it again from the Wallet tab, or cancel it there."}
          </p>
        </div>
        <div className="address-box stack">
          <p className="label">Payment id</p>
          <p className="mono">{sent.txid}</p>
          <div className="row">
            <CopyButton text={sent.txid} small />
            <a className="btn small" href={`${EXPLORER}/search/${sent.txid}`} target="_blank" rel="noreferrer noopener">
              View on ZokaScan
            </a>
          </div>
        </div>
        <button type="button" className="btn primary block mt" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }

  if (flow.step === "failed") {
    return (
      <div className="screen">
        <div className="working">
          <span className="done-mark" style={{ color: "var(--red)", background: "#f08a8a1a" }}>
            <Icon name="alert" />
          </span>
          <p className="title">The payment was not sent</p>
          <p className="muted">{flow.error}</p>
        </div>
        <button type="button" className="btn primary block" onClick={() => setFlow({ step: "form" })}>
          Back
        </button>
      </div>
    );
  }

  if (flow.step === "review") {
    const total = flow.amount + flow.fee;
    return (
      <div className="screen">
        <Header title="Review" onBack={() => setFlow({ step: "form" })} />
        <div className="card mt">
          <div className="card-body stack">
            <div>
              <p className="label">To</p>
              <p className="mono" style={{ marginTop: 4, fontSize: 13 }}>
                {flow.recipient.short || middle(flow.recipient.full, 14)}
              </p>
              {flow.recipient.short && (
                <p className="hint" style={{ marginTop: 4 }}>
                  Full address checked against this short address here.
                </p>
              )}
            </div>
            <div className="spread">
              <span className="label">Amount</span>
              <span>{formatZka(flow.amount)} ZKA</span>
            </div>
            <div className="spread">
              <span className="label">Network fee</span>
              <span>{formatZka(flow.fee)} ZKA</span>
            </div>
            <div className="spread" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <span className="label">Total</span>
              <span style={{ fontSize: 18 }}>{formatZka(total)} ZKA</span>
            </div>
            {flow.memo && (
              <div>
                <p className="label">Note</p>
                <p style={{ marginTop: 4, overflowWrap: "anywhere" }}>{flow.memo}</p>
              </div>
            )}
          </div>
        </div>
        <p className="hint mt">
          The payment's proof is made in this browser and takes a few seconds: keep this tab open. Only the proved
          payment is sent to the network.
        </p>
        <button type="button" className="btn primary block mt" onClick={() => send(flow)}>
          Send {formatZka(flow.amount)} ZKA
        </button>
      </div>
    );
  }

  const blocked = wallet.unsent ? "A payment still has to reach the network: see the Wallet tab." : wallet.pending ? "Your last payment is waiting for a block. Send again once it is mined." : null;

  return (
    <div className="screen">
      <Header title="Send" />
      <form
        className="stack mt"
        onSubmit={(e) => {
          e.preventDefault();
          void review();
        }}
      >
        <Field
          label="To"
          error={error?.field === "to" ? error.text : null}
          hint="A short or a full Zoka Quantic Testnet address."
          right={
            <div className="row" style={{ gap: 2 }}>
              {navigator.clipboard?.readText && (
                <button
                  type="button"
                  className="link"
                  onClick={() => navigator.clipboard.readText().then((text) => onScanned(text), () => undefined)}
                >
                  Paste
                </button>
              )}
              {canScan() && (
                <button type="button" className="icon-btn" onClick={() => setScanning(true)} aria-label="Scan a QR code" style={{ width: 36, height: 28 }}>
                  <Icon name="scan" />
                </button>
              )}
            </div>
          }
        >
          {(id) => (
            <textarea
              id={id}
              className="textarea"
              rows={3}
              value={to}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => {
                setError(null);
                setTo(e.target.value);
              }}
            />
          )}
        </Field>
        <Field
          label="Amount"
          error={error?.field === "amount" ? error.text : null}
          hint={`Available: ${formatZka(wallet.spendable)} ZKA`}
          right={
            wallet.maxSendable > 0 ? (
              <button type="button" className="link" onClick={() => setAmount(atomsToInput(BigInt(wallet.maxSendable)))}>
                Max
              </button>
            ) : undefined
          }
        >
          {(id) => (
            <div className="input-wrap">
              <input
                id={id}
                className="input big"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                autoComplete="off"
                onChange={(e) => {
                  setError(null);
                  setAmount(e.target.value);
                }}
              />
              <span className="label" style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }}>
                ZKA
              </span>
            </div>
          )}
        </Field>
        <Field
          label="Note (optional)"
          error={error?.field === "memo" ? error.text : null}
          hint="Only you and the recipient can read it."
          right={<span className="hint">{memoBytes(memo)} / {MEMO_BYTES}</span>}
        >
          {(id) => <input id={id} className="input" value={memo} maxLength={MEMO_BYTES} onChange={(e) => setMemo(e.target.value)} />}
        </Field>
        {blocked && <p className="hint" role="status">{blocked}</p>}
        <button type="submit" className="btn primary block" disabled={!to.trim() || !amount.trim() || checking || !!blocked}>
          {checking ? "Checking…" : "Review"}
        </button>
      </form>
      {scanning && <Scanner onText={onScanned} onClose={() => setScanning(false)} />}
    </div>
  );
}

function SendWorking() {
  const { state } = useWallet();
  const seconds = useElapsed(true);
  const sending = state?.busy === "sending";
  return (
    <div className="screen">
      <Working
        title={sending ? "Handing it to the network" : "Proving the payment"}
        detail={sending ? "Almost done." : `A STARK proof, made in this browser · ${seconds} s`}
      />
    </div>
  );
}
