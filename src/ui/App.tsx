import { useEffect, useRef, useState } from "react";
import { AUTO_LOCK_MINUTES } from "../config";
import { Activity } from "./Activity";
import { Brand, PublicFrame, SiteFooter } from "./Frame";
import { Icon, Working } from "./components";
import { useWallet } from "./context";
import { Overview } from "./Home";
import { Unlock, Welcome } from "./Onboarding";
import { Receive } from "./Receive";
import { Send } from "./Send";
import { Settings, type SettingsIntent } from "./Settings";

export type Tab = "overview" | "send" | "receive" | "activity" | "settings";

const TABS: { tab: Tab; label: string }[] = [
  { tab: "overview", label: "Overview" },
  { tab: "send", label: "Send" },
  { tab: "receive", label: "Receive" },
  { tab: "activity", label: "Activity" },
  { tab: "settings", label: "Settings" },
];

/** Locks after a while without input, never in the middle of a payment. */
function useAutoLock(active: boolean) {
  const { client } = useWallet();
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const arm = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (client.current()?.busy) arm();
        else void client.lock();
      }, AUTO_LOCK_MINUTES * 60_000);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    const onVisible = () => document.visibilityState === "visible" && void client.refresh();
    document.addEventListener("visibilitychange", onVisible);
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, client]);
}

function LiveStatus() {
  const { state } = useWallet();
  const wallet = state?.wallet;
  if (!state || !wallet) return null;
  const offline = state.sync.state === "offline";
  const syncing = state.sync.state === "syncing" || !wallet.inSync;
  return (
    <span className="live">
      <span className={`dot${offline ? " off" : syncing ? " busy" : ""}`} />
      {offline ? "Offline" : syncing ? `Reading ${wallet.height.toLocaleString("en")} / ${wallet.tip.toLocaleString("en")}` : `Block ${wallet.height.toLocaleString("en")}`}
    </span>
  );
}

function WalletMenu({ onManage, onAdd }: { onManage: () => void; onAdd: () => void }) {
  const { client, state } = useWallet();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const wallet = state?.wallet;
  if (!state || !wallet) return null;
  const pick = (go: () => void) => () => {
    setOpen(false);
    go();
  };
  return (
    <div className="wallet-menu" ref={box}>
      <button
        type="button"
        className="wallet-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Wallet ${wallet.name}. Change wallet`}
        onClick={() => setOpen(!open)}
      >
        <Icon name="wallet" />
        <span>{wallet.name}</span>
        <Icon name="down" />
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Wallets">
          <p className="menu-label">Wallets in this browser</p>
          {state.wallets.map((w) => {
            const active = w.id === wallet.id;
            return (
              <button
                key={w.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className="menu-item"
                onClick={pick(() => !active && void client.switchWallet(w.id).catch(() => undefined))}
              >
                <span>{w.name}</span>
                {active && <Icon name="check" />}
              </button>
            );
          })}
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="menu-item" onClick={pick(onAdd)}>
            <span>Add a wallet</span>
            <Icon name="plus" />
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={pick(onManage)}>
            <span>Manage wallets</span>
            <Icon name="settings" />
          </button>
        </div>
      )}
    </div>
  );
}

function Shell() {
  const { client } = useWallet();
  const [tab, setTab] = useState<Tab>("overview");
  const [intent, setIntent] = useState<SettingsIntent>(null);
  // A new Send each time it is opened.
  const [sendKey, setSendKey] = useState(0);

  // The browser's back button returns to the overview instead of leaving the
  // site: one history entry above the overview's, replaced as sections change.
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { tab?: Tab } | null;
      setTab(state?.tab ?? "overview");
      setIntent(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (next: Tab, nextIntent: SettingsIntent = null) => {
    setIntent(nextIntent);
    if (next === "send" && tab !== "send") setSendKey((k) => k + 1);
    window.scrollTo({ top: 0 });
    if (next === tab) return;
    if (next === "overview") {
      if (window.history.state?.tab) window.history.back();
      setTab("overview");
      return;
    }
    const entry = { tab: next };
    if (window.history.state?.tab) window.history.replaceState(entry, "");
    else window.history.pushState(entry, "");
    setTab(next);
  };

  return (
    <div className="page">
      <header className="site-header">
        <div className="site-nav has-sections">
          <Brand onClick={() => go("overview")} />
          <nav className="sections" aria-label="Wallet sections">
            {TABS.map(({ tab: t, label }) => (
              <button key={t} type="button" className="section-link" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="bar-tools">
            <LiveStatus />
            <WalletMenu onManage={() => go("settings")} onAdd={() => go("settings", "add")} />
            <button type="button" className="icon-btn boxed" onClick={() => void client.lock()} aria-label="Lock the wallet" title="Lock">
              <Icon name="lock" />
            </button>
          </div>
        </div>
      </header>
      <main className="content" key={tab === "send" ? `send-${sendKey}` : tab}>
        {tab === "overview" && <Overview go={go} />}
        {tab === "send" && <Send onDone={() => go("overview")} onActivity={() => go("activity")} />}
        {tab === "receive" && <Receive />}
        {tab === "activity" && <Activity />}
        {tab === "settings" && <Settings intent={intent} onIntentDone={() => setIntent(null)} />}
      </main>
      <SiteFooter />
    </div>
  );
}

export function App() {
  const { state, fatal } = useWallet();
  useAutoLock(state?.phase === "open");
  if (fatal) {
    return (
      <PublicFrame>
        <main className="content">
          <div className="working" style={{ paddingTop: 90 }}>
            <span className="mark bad">
              <Icon name="alert" />
            </span>
            <p className="step-title">The wallet cannot start here</p>
            <p className="muted">{fatal}</p>
            <p className="hint">It needs WebAssembly and the browser's storage. Private windows of some browsers do not allow them.</p>
          </div>
        </main>
      </PublicFrame>
    );
  }
  if (!state || state.phase === "loading") {
    return (
      <PublicFrame>
        <main className="content">
          <Working title="Starting the wallet" />
        </main>
      </PublicFrame>
    );
  }
  if (state.phase === "empty") return <Welcome />;
  if (state.phase === "locked") return <Unlock />;
  return <Shell />;
}
