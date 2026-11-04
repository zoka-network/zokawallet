import { useEffect, useState } from "react";
import { AUTO_LOCK_MINUTES } from "../config";
import { Activity } from "./Activity";
import { Icon, Working, type IconName } from "./components";
import { useWallet } from "./context";
import { Home } from "./Home";
import { Unlock, Welcome } from "./Onboarding";
import { Receive } from "./Receive";
import { Send } from "./Send";
import { Settings } from "./Settings";

type Tab = "home" | "send" | "receive" | "activity" | "settings";
type SettingsPage = Parameters<typeof Settings>[0]["page"];

const TABS: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: "home", label: "Wallet", icon: "wallet" },
  { tab: "send", label: "Send", icon: "send" },
  { tab: "receive", label: "Receive", icon: "receive" },
  { tab: "activity", label: "Activity", icon: "activity" },
  { tab: "settings", label: "Settings", icon: "settings" },
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

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  const [settings, setSettings] = useState<SettingsPage>("main");
  // A new Send each time the tab is opened, unless it holds a scanned text.
  const [sendKey, setSendKey] = useState(0);

  // The browser's back button returns to the Wallet tab (as in ZKAPriv),
  // instead of leaving the site: one history entry above the Wallet one,
  // replaced as the tabs change.
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { tab?: Tab; settings?: SettingsPage } | null;
      setTab(state?.tab ?? "home");
      setSettings(state?.settings ?? "main");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (next: Tab, page: SettingsPage = "main") => {
    if (next === "send" && tab !== "send") setSendKey((k) => k + 1);
    if (next === tab && page === settings) return;
    if (next === "home") {
      if (window.history.state?.tab) window.history.back();
      setTab("home");
      setSettings("main");
      return;
    }
    const entry = { tab: next, settings: page };
    if (window.history.state?.tab) window.history.replaceState(entry, "");
    else window.history.pushState(entry, "");
    setTab(next);
    setSettings(page);
  };

  return (
    <>
      <main key={tab === "send" ? `send-${sendKey}` : tab} style={{ display: "contents" }}>
        {tab === "home" && <Home onWallets={() => go("settings", "wallets")} />}
        {tab === "send" && <Send onDone={() => go("home")} />}
        {tab === "receive" && <Receive />}
        {tab === "activity" && <Activity />}
        {tab === "settings" && <Settings page={settings} onPage={(page) => go("settings", page)} />}
      </main>
      <nav className="tabs" aria-label="Wallet sections">
        {TABS.map(({ tab: t, label, icon }) => (
          <button key={t} type="button" className="tab" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}

export function App() {
  const { state, fatal } = useWallet();
  useAutoLock(state?.phase === "open");
  let body;
  if (fatal) {
    body = (
      <div className="screen plain">
        <div className="working">
          <span className="done-mark" style={{ color: "var(--red)", background: "#f08a8a1a" }}>
            <Icon name="alert" />
          </span>
          <p className="title">The wallet cannot start here</p>
          <p className="muted">{fatal}</p>
          <p className="hint">
            It needs WebAssembly and the browser's storage. Private windows of some browsers do not allow them.
          </p>
        </div>
      </div>
    );
  } else if (!state || state.phase === "loading") {
    body = <Working title="Starting the wallet" />;
  } else if (state.phase === "empty") {
    body = <Welcome />;
  } else if (state.phase === "locked") {
    body = <Unlock />;
  } else {
    body = <Shell />;
  }
  return <div className="app">{body}</div>;
}
