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
        </div>
      </div>
    </>
  );
}
