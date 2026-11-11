import { useEffect, useState, type ReactNode } from "react";
import { API, AUTO_LOCK_MINUTES, EXPLORER, MIN_PASSWORD, NETWORK_NAME, SITE, SOURCE } from "../config";
import { CopyButton, Dialog, Field, Icon, PageHead, Panel, PasswordInput, Working, type IconName } from "./components";
import { useWallet } from "./context";
import { ConfirmStep, ForgetDialog, RestoreStep, TestnetNotice, Words, WordsStep } from "./Onboarding";

/** What Settings opens on arrival (from the wallet menu). */
export type SettingsIntent = null | "add";

type Open = null | "add" | "phrase" | "viewkey" | "password" | "forget" | { edit: { id: string; name: string } };

function Setting({
  icon,
  title,
  sub,
  on,
  children,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  on?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="setting">
      <span className={`item-icon${on ? " on" : ""}`}>
        <Icon name={icon} />
      </span>
      <span className="grow">
        <span className="setting-title">{title}</span>
        {sub && <span className="setting-sub">{sub}</span>}
      </span>
      {children}
    </li>
  );
}

export function Settings({ intent, onIntentDone }: { intent: SettingsIntent; onIntentDone: () => void }) {
  const { client, state } = useWallet();
  const [open, setOpen] = useState<Open>(intent);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (intent) {
      setOpen(intent);
      onIntentDone();
    }
  }, [intent, onIntentDone]);
  const wallet = state?.wallet;
  if (!state || !wallet) return null;
  const close = () => setOpen(null);

  return (
    <>
      <PageHead eyebrow="Settings" title="Settings" lede="The wallets of this browser, their keys, the password that seals them, and what this build is." />
      <div className="settings-grid">
        <Panel
          title={`Wallets · ${state.wallets.length}`}
          action={
            <button type="button" className="btn small" onClick={() => setOpen("add")}>
              <Icon name="plus" />
              Add a wallet
            </button>
          }
        >
          <ul aria-label="Wallets in this browser">
            {state.wallets.map((w) => {
              const active = w.id === wallet.id;
              return (
                <Setting key={w.id} icon={active ? "check" : "wallet"} on={active} title={w.name} sub={active ? "Open now" : undefined}>
                  {!active && (
                    <button type="button" className="btn small" onClick={() => client.switchWallet(w.id).catch((e: Error) => setError(e.message))}>
                      Open
                    </button>
                  )}
                  <button type="button" className="btn small" onClick={() => setOpen({ edit: w })} aria-label={`Edit ${w.name}`}>
                    Edit
                  </button>
                </Setting>
              );
            })}
          </ul>
          <div className="panel-foot">
            {error ? <p className="error">{error}</p> : <p className="hint">Every wallet here opens with the same password. Each has its own 24 words.</p>}
          </div>
        </Panel>

        <Panel title="Security">
          <ul>
            <Setting icon="key" title="Recovery words" sub={`The 24 words that restore ${wallet.name}`}>
              <button type="button" className="btn small" onClick={() => setOpen("phrase")}>
                Show
              </button>
            </Setting>
            <Setting icon="eye" title="View keys" sub="Share incoming payments, or the full history">
              <button type="button" className="btn small" onClick={() => setOpen("viewkey")}>
                Show
              </button>
            </Setting>
            <Setting icon="shield" title="Password" sub="Opens every wallet in this browser">
              <button type="button" className="btn small" onClick={() => setOpen("password")}>
                Change
              </button>
            </Setting>
            <Setting icon="lock" title="Auto-lock" sub={`After ${AUTO_LOCK_MINUTES} minutes without use, except during a payment`}>
              <button type="button" className="btn small" onClick={() => void client.lock()}>
                Lock now
              </button>
            </Setting>
          </ul>
        </Panel>

        <Panel title="About">
          <dl className="facts">
            <dt>Version</dt>
            <dd>Zoka Web Wallet {__APP_VERSION__}</dd>
            <dt>Network</dt>
            <dd>{NETWORK_NAME}</dd>
            <dt>Reads from</dt>
            <dd className="mono">{API.replace("https://", "")}</dd>
            <dt>This build</dt>
            <dd>
              <a href="/SHA256SUMS.txt">Checksums</a> · <a href={SOURCE} target="_blank" rel="noopener noreferrer">Source code ↗</a>
            </dd>
            <dt>Zoka</dt>
            <dd>
              <a href={SITE} target="_blank" rel="noopener noreferrer">zoka.network ↗</a> · <a href={EXPLORER} target="_blank" rel="noopener noreferrer">ZokaScan ↗</a>
            </dd>
          </dl>
          <div className="panel-foot stack" style={{ gap: 12 }}>
            <p className="hint">Recovery words, keys, balance and proofs never leave this browser. The node it reads from sees the same pages of the chain as every other wallet.</p>
            <TestnetNotice />
          </div>
        </Panel>

        <Panel title="This browser" className="danger">
          <div className="panel-body stack">
            <p className="muted">Deletes every wallet stored here. The coins stay on the chain and come back with each wallet's 24 words, here or in ZSilent or ZKAPriv.</p>
            <div className="actions start">
              <button type="button" className="btn danger" onClick={() => setOpen("forget")}>
                <Icon name="trash" />
                Forget this browser’s wallets
              </button>
            </div>
          </div>
        </Panel>
      </div>

      {open === "add" && <AddWallet onClose={close} />}
      {open === "phrase" && <Phrase onClose={close} />}
      {open === "viewkey" && <ViewKey key={wallet.id} onClose={close} />}
      {open === "password" && <ChangePassword onClose={close} />}
      {open === "forget" && <ForgetDialog onClose={close} />}
      {open && typeof open === "object" && <EditWallet wallet={open.edit} only={state.wallets.length === 1} onClose={close} />}
    </>
  );
}

type AddFlow = { step: "choose" } | { step: "words" | "confirm"; phrase: string } | { step: "restore" } | { step: "name"; phrase: string; from: "confirm" | "restore" };

function AddWallet({ onClose }: { onClose: () => void }) {
  const { client, state } = useWallet();
  const [flow, setFlow] = useState<AddFlow>({ step: "choose" });
  const [name, setName] = useState(`Wallet ${(state?.wallets.length ?? 0) + 1}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titles: Record<AddFlow["step"], string> = {
    choose: "Add a wallet",
    words: "Its recovery words",
    confirm: "Check the words",
    restore: "Restore a wallet",
    name: "Name the wallet",
  };
  return (
    <Dialog title={titles[flow.step]} onClose={onClose} wide={flow.step === "words"}>
      {flow.step === "choose" && (
        <>
          <p className="muted">A new wallet gets its own 24 words. A wallet from ZSilent or ZKAPriv comes with the words it already has.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setFlow({ step: "restore" })}>
              <Icon name="key" />
              Restore with 24 words
            </button>
            <button type="button" className="btn primary" onClick={() => client.newPhrase().then((phrase) => setFlow({ step: "words", phrase }))}>
              <Icon name="plus" />
              Create a new one
            </button>
          </div>
        </>
      )}
      {flow.step === "words" && (
        <WordsStep phrase={flow.phrase} onBack={() => setFlow({ step: "choose" })} onNext={() => setFlow({ step: "confirm", phrase: flow.phrase })} />
      )}
      {flow.step === "confirm" && (
        <ConfirmStep
          phrase={flow.phrase}
          onBack={() => setFlow({ step: "words", phrase: flow.phrase })}
          onNext={() => setFlow({ step: "name", phrase: flow.phrase, from: "confirm" })}
        />
      )}
      {flow.step === "restore" && <RestoreStep onBack={() => setFlow({ step: "choose" })} onNext={(phrase) => setFlow({ step: "name", phrase, from: "restore" })} />}
      {flow.step === "name" &&
        (busy ? (
          <Working title="Adding the wallet" />
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              client.addWallet(name, flow.phrase).then(onClose, (err: Error) => {
                setBusy(false);
                setError(err.message);
              });
            }}
          >
            <Field label="Wallet name" error={error} hint="Only you see it. It opens with the password of this browser.">
              {(id) => <input id={id} className="input" value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} />}
            </Field>
            <div className="actions">
              <button
                type="button"
                className="btn"
                onClick={() => setFlow(flow.from === "restore" ? { step: "restore" } : { step: "confirm", phrase: flow.phrase })}
              >
                Back
              </button>
              <button type="submit" className="btn primary wide">
                Add wallet
              </button>
            </div>
          </form>
        ))}
    </Dialog>
  );
}

function EditWallet({ wallet, only, onClose }: { wallet: { id: string; name: string }; only: boolean; onClose: () => void }) {
  const { client } = useWallet();
  const [name, setName] = useState(wallet.name);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog title={removing ? `Remove ${wallet.name}` : "Edit wallet"} onClose={onClose}>
      {removing ? (
        <>
          <p className="muted">
            This browser forgets the wallet. Its coins stay on the chain: its 24 words restore it here or in ZSilent or
            ZKAPriv. Without them it cannot come back.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="button" className="btn" onClick={() => setRemoving(false)}>
              Back
            </button>
            <button type="button" className="btn danger" onClick={() => client.removeWallet(wallet.id).then(onClose, (e: Error) => setError(e.message))}>
              Remove it from this browser
            </button>
          </div>
        </>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            client.renameWallet(wallet.id, name).then(onClose, (err: Error) => setError(err.message));
          }}
        >
          <Field label="Name" error={error}>
            {(id) => <input id={id} className="input" value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} />}
          </Field>
          <div className="actions">
            {!only && (
              <button type="button" className="btn danger" onClick={() => setRemoving(true)} style={{ marginRight: "auto" }}>
                Remove from this browser
              </button>
            )}
            <button type="submit" className="btn primary wide" disabled={!name.trim()}>
              Save
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function Phrase({ onClose }: { onClose: () => void }) {
  const { client, state } = useWallet();
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title="Recovery words" onClose={onClose} wide={!!phrase}>
      {busy ? (
        <Working title="Checking the password" />
      ) : phrase ? (
        <>
          <p className="muted">
            The 24 words of {state?.wallet?.name}. Anyone who sees them can spend this wallet: never share them, never type
            them into another site.
          </p>
          <Words phrase={phrase} />
          <div className="actions">
            <button type="button" className="btn primary wide" onClick={onClose}>
              Hide them
            </button>
          </div>
        </>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            client.revealPhrase(password).then(
              (words) => {
                setBusy(false);
                setPassword("");
                setPhrase(words);
              },
              (err: Error) => {
                setBusy(false);
                setError(err.message);
              },
            );
          }}
        >
          <p className="muted">Make sure nobody can see your screen.</p>
          <Field label="Password" error={error}>
            {(id) => (
              <PasswordInput
                id={id}
                value={password}
                onChange={(v) => {
                  setError(null);
                  setPassword(v);
                }}
                autoComplete="current-password"
                autoFocus
              />
            )}
          </Field>
          <div className="actions">
            <button type="submit" className="btn primary wide" disabled={!password}>
              Show the words
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function ViewKey({ onClose }: { onClose: () => void }) {
  const { client } = useWallet();
  const [kind, setKind] = useState<"incoming" | "full">("incoming");
  const [shown, setShown] = useState<{ kind: "incoming" | "full"; value: string } | null>(null);
  const key = shown?.kind === kind ? shown.value : null;
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setShown(null);
    setError(null);
    const request = kind === "incoming" ? client.incomingViewKey() : client.viewKey();
    request.then(
      (value) => { if (active) setShown({ kind, value }); },
      (failure: Error) => { if (active) setError(failure.message); },
    );
    return () => { active = false; };
  }, [client, kind]);
  return (
    <Dialog title="View keys" onClose={onClose}>
      <fieldset className="stack view-key-options">
        <legend className="label">What to share</legend>
        <label><input type="radio" name="view-key-kind" value="incoming" checked={kind === "incoming"} onChange={() => { setShown(null); setKind("incoming"); }} /> Incoming payments only</label>
        <label><input type="radio" name="view-key-kind" value="full" checked={kind === "full"} onChange={() => { setShown(null); setKind("full"); }} /> Full history and balance</label>
      </fieldset>
      <p className="muted">
        {kind === "incoming"
          ? "The incoming view key shows received payments and memos, without your balance or outgoing payments."
          : "The full view key shows your balance and every incoming and outgoing payment, past and future."}
        {" "}Neither key can spend. Share only with someone who should have this access; it cannot be revoked.
      </p>
      {kind === "incoming" && <p className="hint">Change from older wallets may appear as a received payment.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {key ? (
        <>
          <div className="address-box scroll">
            <p className="mono">{key}</p>
          </div>
          <div className="actions">
            <CopyButton text={key} label={kind === "incoming" ? "Copy incoming view key" : "Copy full view key"} />
          </div>
        </>
      ) : (
        !error && <p role="status" className="muted">Loading the view key…</p>
      )}
    </Dialog>
  );
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const { client } = useWallet();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ready = current && next.length >= MIN_PASSWORD && next === repeat;
  return (
    <Dialog title="Change the password" onClose={onClose}>
      {busy ? (
        <Working title="Sealing everything again" detail="With the new password." />
      ) : done ? (
        <>
          <div className="working" style={{ padding: "12px 0" }}>
            <span className="mark">
              <Icon name="check" />
            </span>
            <p className="step-title">Password changed</p>
          </div>
          <div className="actions">
            <button type="button" className="btn primary wide" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            setBusy(true);
            client.changePassword(current, next).then(
              () => {
                setBusy(false);
                setDone(true);
              },
              (err: Error) => {
                setBusy(false);
                setError(err.message);
              },
            );
          }}
        >
          <Field label="Current password" error={error}>
            {(id) => (
              <PasswordInput
                id={id}
                value={current}
                onChange={(v) => {
                  setError(null);
                  setCurrent(v);
                }}
                autoComplete="current-password"
                autoFocus
              />
            )}
          </Field>
          <Field label="New password" error={next && next.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters` : null}>
            {(id) => <PasswordInput id={id} value={next} onChange={setNext} autoComplete="new-password" />}
          </Field>
          <Field label="Repeat the new password" error={repeat && repeat !== next ? "The passwords are different" : null}>
            {(id) => <PasswordInput id={id} value={repeat} onChange={setRepeat} autoComplete="new-password" />}
          </Field>
          <div className="actions">
            <button type="submit" className="btn primary wide" disabled={!ready}>
              Change password
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
