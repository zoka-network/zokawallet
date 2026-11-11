import { useState } from "react";
import { CopyButton, Icon, PageHead, Panel, Qr } from "./components";
import { useWallet } from "./context";

// The short address is the one to share (and the one in the QR, as in
// ZKAPriv). The full one always works, also before the short one resolves.

export function Receive() {
  const { state } = useWallet();
  const [full, setFull] = useState(false);
  const wallet = state?.wallet;
  if (!wallet) return null;
  return (
    <>
      <PageHead
        eyebrow={`${wallet.name} · Receive`}
        title="Receive ZKA"
        lede="Anyone with ZSilent, ZKAPriv or this wallet can pay this address. Sharing it does not show your balance or your payments."
      />
      <div className="split even">
        <Panel title="QR code">
          <div className="qr-panel">
            {wallet.published ? (
              <Qr text={wallet.short} label="QR code of your short address" />
            ) : (
              <div className="banner" style={{ width: "100%" }}>
                <Icon name="light" />
                <p className="grow">
                  {wallet.publishing
                    ? "Activating your short address. This takes a few seconds."
                    : "Your short address activates once the network answers. Meanwhile, share the full address."}
                </p>
              </div>
            )}
          </div>
        </Panel>
        <div className="stack" style={{ gap: 24 }}>
          {wallet.published && (
            <Panel title="Short address">
              <div className="panel-body stack">
                <p className="address-short">{wallet.short}</p>
                <div className="actions start">
                  <CopyButton text={wallet.short} label="Copy address" />
                </div>
                <p className="hint">The payer's wallet turns it into the full address and checks that both belong together.</p>
              </div>
            </Panel>
          )}
          <Panel>
            <button type="button" className="disclose" onClick={() => setFull(!full)} aria-expanded={full}>
              <span className="grow">
                <span className="disclose-title">Full address</span>
                <span className="disclose-sub">Long, but it always works.</span>
              </span>
              <Icon name={full ? "down" : "chevron"} />
            </button>
            {full && (
              <div className="panel-body stack" style={{ borderTop: "1px solid var(--line-soft)" }}>
                <div className="address-box scroll">
                  <p className="mono">{wallet.address}</p>
                </div>
                <div className="actions start">
                  <CopyButton text={wallet.address} label="Copy full address" />
                </div>
              </div>
            )}
          </Panel>
          <MoreAddresses />
        </div>
      </div>
    </>
  );
}

// Point 4 of the 10/11 review: another address for each person who pays.
// They cannot tell they paid the same wallet; everything adds to one balance.
function MoreAddresses() {
  const { client, state } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const wallet = state?.wallet;
  if (!wallet) return null;
  const add = () => {
    setBusy(true);
    setError(null);
    client
      .addAddress()
      .then((next) => setShown(next.wallet?.extra.at(-1)?.index ?? null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  const current = wallet.extra.find((a) => a.index === shown);
  return (
    <Panel
      title={`More addresses · ${wallet.extra.length} of 7`}
      action={
        <button type="button" className="btn small" onClick={add} disabled={busy || !wallet.canAddAddress}>
          {busy ? "Adding…" : "New address"}
        </button>
      }
    >
      <div className="panel-body stack">
        <p className="hint">
          Give a different address to each person who pays you: they cannot tell they paid the same wallet. Everything
          arrives in this balance. Create it before giving it out: payments to it are found from then on.
        </p>
        {wallet.extra.map((a) => (
          <div key={a.index} className="actions start" style={{ alignItems: "center" }}>
            <button type="button" className="btn small" onClick={() => setShown(shown === a.index ? null : a.index)}>
              #{a.index}
            </button>
            <span className="mono grow" style={{ overflowWrap: "anywhere" }}>
              {a.short}
            </span>
            <CopyButton text={a.short} label="Copy" small />
            {!a.published && <span className="hint">activating…</span>}
          </div>
        ))}
        {current && (
          <div className="qr-panel">
            <Qr text={current.short} label={`QR code of address ${current.index}`} />
          </div>
        )}
        {error && <p className="hint" role="alert">{error}</p>}
      </div>
    </Panel>
  );
}
