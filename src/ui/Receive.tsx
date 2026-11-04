import { useState } from "react";
import { CopyButton, Header, Icon, Qr } from "./components";
import { useWallet } from "./context";

// The short address is the one to share (and the one in the QR, as in
// ZKAPriv). The full one always works, also before the short one resolves.

export function Receive() {
  const { state } = useWallet();
  const [full, setFull] = useState(false);
  const wallet = state?.wallet;
  if (!wallet) return null;
  return (
    <div className="screen">
      <Header title="Receive" />
      <div className="stack mt">
        {wallet.published ? (
          <>
            <Qr text={wallet.short} label="QR code of your short address" />
            <div className="address-box stack">
              <p className="label">Your short address</p>
              <p className="mono" style={{ fontSize: 14 }}>
                {wallet.short}
              </p>
              <CopyButton text={wallet.short} label="Copy address" />
            </div>
            <p className="hint center">Anyone with ZSilent, ZKAPriv or this wallet can pay it. Your balance stays private.</p>
          </>
        ) : (
          <div className="strip pink">
            <Icon name="light" />
            <p className="grow">
              {wallet.publishing
                ? "Activating your short address. This takes a few seconds."
                : "Your short address activates once the network answers. Meanwhile, share the full address."}
            </p>
          </div>
        )}
        <div className="card">
          <button type="button" className="item" style={{ padding: "14px 18px" }} onClick={() => setFull(!full)} aria-expanded={full}>
            <span className="grow">
              <span className="item-title" style={{ display: "block" }}>
                Full address
              </span>
              <span className="item-sub" style={{ display: "block" }}>
                About 1,760 characters. Works everywhere, always.
              </span>
            </span>
            <Icon name={full ? "down" : "chevron"} />
          </button>
          {full && (
            <div className="card-body stack" style={{ borderTop: "1px solid var(--line-soft)" }}>
              <p className="mono" style={{ maxHeight: 180, overflow: "auto", fontSize: 11 }}>
                {wallet.address}
              </p>
              <CopyButton text={wallet.address} label="Copy full address" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
