import { useCallback, useState } from "react";
import { EXPLORER, MEMO_BYTES } from "../config";
import type { Recipient, Sent } from "../core/wallet-core";
import { AmountError, atomsToInput, formatZka, memoBytes, parseZka } from "../lib/amount";
import { middle, parsePaymentText } from "../lib/payment";
import { CopyButton, Field, Icon, PageHead, Panel, useElapsed } from "./components";
import { useWallet } from "./context";
import { Scanner, canScan } from "./Scanner";

type Step =
  | { step: "form" }
  | { step: "review"; recipient: Recipient; amount: bigint; fee: bigint; memo: string }
  | { step: "working" }
  | { step: "done"; sent: Sent }
  | { step: "failed"; error: string };

const STEP_NAMES: Record<Step["step"], string> = {
  form: "Payment",
  review: "Review",
  working: "Proving",
  done: "Sent",
  failed: "Not sent",
};

export function Send({ initial, onDone, onActivity }: { initial?: string; onDone: () => void; onActivity: () => void }) {
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

  const blocked = wallet.unsent
    ? "A payment still has to reach the network: see the overview."
    : wallet.pending
      ? "Your last payment is waiting for a block. Send again once it is mined."
      : null;

  let body;
  if (flow.step === "working") {
    body = <SendWorking />;
  } else if (flow.step === "done") {
    const { sent } = flow;
    body = (
      <div className="panel-body stack">
        <div className="working" style={{ padding: "20px 0 6px" }}>
          <span className={`mark${sent.delivered ? "" : " bad"}`}>
            <Icon name={sent.delivered ? "check" : "alert"} />
          </span>
          <p className="step-title">{sent.delivered ? "Payment sent" : "Proved, not delivered"}</p>
          <p className="amount-big">
            {formatZka(sent.amount_atoms)}
            <span className="unit" style={{ fontSize: 13, verticalAlign: "middle" }}>
              ZKA
            </span>
          </p>
          <p className="muted">
            {sent.delivered
              ? "It joins the chain with the next block, usually within a few minutes."
              : "The network could not be reached. Send it again from the overview, or cancel it there."}
          </p>
        </div>
        <div className="address-box stack">
          <p className="label">Payment id</p>
          <p className="mono">{sent.txid}</p>
          <div className="actions start">
            <CopyButton text={sent.txid} label="Copy id" small />
            <a className="btn small" href={`${EXPLORER}/search/${sent.txid}`} target="_blank" rel="noreferrer noopener">
              View on ZokaScan
              <Icon name="external" />
            </a>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={onActivity}>
            Activity
          </button>
          <button type="button" className="btn primary wide" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    );
  } else if (flow.step === "failed") {
    body = (
      <div className="panel-body stack">
        <div className="working" style={{ padding: "20px 0 6px" }}>
          <span className="mark bad">
            <Icon name="alert" />
          </span>
          <p className="step-title">The payment was not sent</p>
          <p className="muted">{flow.error}</p>
        </div>
        <div className="actions">
          <button type="button" className="btn primary wide" onClick={() => setFlow({ step: "form" })}>
            Back
          </button>
        </div>
      </div>
    );
  } else if (flow.step === "review") {
    const total = flow.amount + flow.fee;
    body = (
      <div className="panel-body stack">
        <dl className="facts flush">
          <dt>To</dt>
          <dd>
            <span className="mono" style={{ fontSize: 13 }}>
              {flow.recipient.short || middle(flow.recipient.full, 14)}
            </span>
            {flow.recipient.short && <span className="hint" style={{ display: "block", marginTop: 4 }}>Full address checked against this short address here.</span>}
          </dd>
          <dt>Amount</dt>
          <dd>{formatZka(flow.amount)} ZKA</dd>
          <dt>Network fee</dt>
          <dd>{formatZka(flow.fee)} ZKA</dd>
          <dt>Total</dt>
          <dd className="total">{formatZka(total)} ZKA</dd>
          {flow.memo && (
            <>
              <dt>Note</dt>
              <dd>{flow.memo}</dd>
            </>
          )}
        </dl>
        <p className="hint">The payment's proof is made in this browser and takes a few seconds: keep this tab open. Only the proved payment is sent to the network.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setFlow({ step: "form" })}>
            Edit
          </button>
          <button type="button" className="btn primary wide" onClick={() => send(flow)}>
            Send {formatZka(flow.amount)} ZKA
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <form
        className="panel-body stack"
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
            <div className="row" style={{ gap: 14 }}>
              {navigator.clipboard?.readText && (
                <button type="button" className="link" onClick={() => navigator.clipboard.readText().then((text) => onScanned(text), () => undefined)}>
                  Paste
                </button>
              )}
              {canScan() && (
                <button type="button" className="link" onClick={() => setScanning(true)}>
                  Scan QR
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
              placeholder="zqtest2…"
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
              <span className="input-unit">ZKA</span>
            </div>
          )}
        </Field>
        <Field
          label="Note (optional)"
          error={error?.field === "memo" ? error.text : null}
          hint="Only you and the recipient can read it."
          right={
            <span className="hint">
              {memoBytes(memo)} / {MEMO_BYTES}
            </span>
          }
        >
          {(id) => <input id={id} className="input" value={memo} maxLength={MEMO_BYTES} onChange={(e) => setMemo(e.target.value)} />}
        </Field>
        {blocked && (
          <p className="banner amber" role="status">
            {blocked}
          </p>
        )}
        <div className="actions">
          <button type="submit" className="btn primary wide" disabled={!to.trim() || !amount.trim() || checking || !!blocked}>
            {checking ? "Checking…" : "Review"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <PageHead
        eyebrow={`${wallet.name} · Send`}
        title="Send ZKA"
        lede="To a short or a full address. The payment is proved in this browser before it is sent, and its amount and note stay between you and the recipient."
      />
      <div className="split">
        <Panel title={STEP_NAMES[flow.step]} label="Payment">
          {body}
        </Panel>
        <Panel title="From this wallet">
          <dl className="facts">
            <dt>Wallet</dt>
            <dd>{wallet.name}</dd>
            <dt>Available</dt>
            <dd>{formatZka(wallet.spendable)} ZKA</dd>
            <dt>Max in one payment</dt>
            <dd>{formatZka(wallet.maxSendable)} ZKA</dd>
            {wallet.reserved > 0 && (
              <>
                <dt>Waiting</dt>
                <dd>{formatZka(wallet.reserved)} ZKA</dd>
              </>
            )}
          </dl>
          <div className="panel-foot">
            <p className="hint">
              One payment at a time: while one waits for its block, the next has to wait too. Payments expire if no
              block takes them within 20 blocks, and the ZKA come back.
            </p>
          </div>
        </Panel>
      </div>
      {scanning && <Scanner onText={onScanned} onClose={() => setScanning(false)} />}
    </>
  );
}

function SendWorking() {
  const { state } = useWallet();
  const seconds = useElapsed(true);
  const sending = state?.busy === "sending";
  return (
    <div className="working" role="status" aria-live="polite">
      <div className="spinner" />
      <p className="step-title">{sending ? "Handing it to the network" : "Proving the payment"}</p>
      <p className="muted">{sending ? "Almost done." : `A STARK proof, made in this browser · ${seconds} s`}</p>
      <ol className="progress">
        <li className="done">
          <i />
          Notes chosen and reserved
        </li>
        <li className={sending ? "done" : "now"}>
          <i />
          STARK proof
        </li>
        <li className={sending ? "now" : ""}>
          <i />
          Delivered to the network
        </li>
      </ol>
    </div>
  );
}
