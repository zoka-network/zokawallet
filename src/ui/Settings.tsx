import { useState } from "react";
import { EXPLORER, MIN_PASSWORD, NETWORK_NAME, SITE, SOURCE } from "../config";
import { CopyButton, Field, Header, Icon, PasswordInput, Sheet, Working } from "./components";
import { useWallet } from "./context";
import { ConfirmStep, ForgetSheet, RestoreStep, TestnetNotice, WordsStep } from "./Onboarding";

type Page = "main" | "wallets" | "phrase" | "viewkey" | "password";

export function Settings({ page, onPage }: { page: Page; onPage: (page: Page) => void }) {
  const { client, state } = useWallet();
  const [forget, setForget] = useState(false);
  if (!state?.wallet) return null;
  if (page === "wallets") return <Wallets onBack={() => onPage("main")} />;
  if (page === "phrase") return <Phrase onBack={() => onPage("main")} />;
  if (page === "viewkey") return <ViewKey onBack={() => onPage("main")} />;
  if (page === "password") return <ChangePassword onBack={() => onPage("main")} />;
  const row = (label: string, detail: string, go: () => void, icon: Parameters<typeof Icon>[0]["name"]) => (
    <li>
      <button type="button" className="item" onClick={go}>
        <span className="item-icon">
          <Icon name={icon} />
        </span>
        <span className="grow">
          <span className="item-title" style={{ display: "block" }}>
            {label}
          </span>
          <span className="item-sub" style={{ display: "block" }}>
            {detail}
          </span>
        </span>
        <Icon name="chevron" />
      </button>
    </li>
  );
  return (
    <div className="screen">
      <Header title="Settings" />
      <div className="section">
        <span className="label">Wallets</span>
        <ul className="list">
          {row("Wallets", `${state.wallets.length} in this browser · ${state.wallet.name} open`, () => onPage("wallets"), "wallet")}
        </ul>
      </div>
      <div className="section">
        <span className="label">Security</span>
        <ul className="list">
          {row("Recovery words", "The 24 words that restore it", () => onPage("phrase"), "eye")}
          {row("View key", "Shows the balance, cannot spend", () => onPage("viewkey"), "eye")}
          {row("Password", "Opens every wallet here", () => onPage("password"), "lock")}
          <li>
            <button type="button" className="item" onClick={() => void client.lock()}>
              <span className="item-icon">
                <Icon name="lock" />
              </span>
              <span className="grow item-title">Lock now</span>
            </button>
          </li>
        </ul>
      </div>
      <div className="section">
        <span className="label">About</span>
        <div className="stack" style={{ marginTop: 8 }}>
          <p className="hint">
            Zoka Web Wallet {__APP_VERSION__} · {NETWORK_NAME}. Recovery words, keys, balance and proofs never leave this
            browser; the node it reads from sees the same pages of the chain as every other wallet.
          </p>
          <TestnetNotice />
          <nav className="footer-links" style={{ justifyContent: "flex-start", marginTop: 4 }} aria-label="Zoka">
            <a href={SITE}>zoka.network</a>
            <a href={EXPLORER}>ZokaScan</a>
            <a href={SOURCE}>Source code</a>
            <a href="/SHA256SUMS.txt">Checksums of this build</a>
          </nav>
        </div>
      </div>
      <div className="section">
        <button type="button" className="btn danger block" onClick={() => setForget(true)}>
          Forget this browser’s wallets
        </button>
      </div>
      {forget && <ForgetSheet onClose={() => setForget(false)} />}
    </div>
  );
}

type AddFlow = null | { step: "choose" } | { step: "words" | "confirm"; phrase: string } | { step: "restore" } | { step: "name"; phrase: string };

function Wallets({ onBack }: { onBack: () => void }) {
  const { client, state } = useWallet();
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const [add, setAdd] = useState<AddFlow>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!state?.wallet) return null;

  if (add?.step === "words") {
    return <WordsStep phrase={add.phrase} onBack={() => setAdd(null)} onNext={() => setAdd({ step: "confirm", phrase: add.phrase })} />;
  }
  if (add?.step === "confirm") {
    return <ConfirmStep phrase={add.phrase} onBack={() => setAdd({ step: "words", phrase: add.phrase })} onNext={() => setAdd({ step: "name", phrase: add.phrase })} />;
  }
  if (add?.step === "restore") {
    return <RestoreStep onBack={() => setAdd(null)} onNext={(phrase) => setAdd({ step: "name", phrase })} />;
  }
  if (add?.step === "name") {
    return (
      <NameStep
        title="Name the wallet"
        initial={`Wallet ${state.wallets.length + 1}`}
        error={error}
        busy={busy}
        onBack={() => setAdd(null)}
        onDone={(name) => {
          setBusy(true);
          setError(null);
          client.addWallet(name, add.phrase).then(
            () => {
              setBusy(false);
              setAdd(null);
              onBack();
            },
            (e: Error) => {
              setBusy(false);
              setError(e.message);
            },
          );
        }}
      />
    );
  }

  return (
    <div className="screen">
      <Header title="Wallets" onBack={onBack} />
      <ul className="list mt" aria-label="Wallets in this browser">
        {state.wallets.map((w) => {
          const active = w.id === state.wallet!.id;
          return (
            <li key={w.id} className="row">
              <button
                type="button"
                className="item grow"
                aria-current={active ? "true" : undefined}
                onClick={() => (active ? onBack() : client.switchWallet(w.id).then(onBack, (e: Error) => setError(e.message)))}
              >
                <span className={`item-icon${active ? " out" : ""}`}>
                  <Icon name={active ? "check" : "wallet"} />
                </span>
                <span className="grow item-title">{w.name}</span>
              </button>
              <button type="button" className="link" onClick={() => setEdit({ id: w.id, name: w.name })} aria-label={`Edit ${w.name}`}>
                Edit
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
      <button type="button" className="btn block mt" onClick={() => setAdd({ step: "choose" })}>
        <Icon name="plus" />
        Add a wallet
      </button>
      <p className="hint mt">Every wallet here opens with the same password. Each has its own 24 words.</p>

      {add?.step === "choose" && (
        <Sheet title="Add a wallet" onClose={() => setAdd(null)}>
          <button type="button" className="btn primary block" onClick={() => client.newPhrase().then((phrase) => setAdd({ step: "words", phrase }))}>
            Create a new one
          </button>
          <button type="button" className="btn block" onClick={() => setAdd({ step: "restore" })}>
            Restore with 24 words
          </button>
        </Sheet>
      )}
      {edit && <EditWallet wallet={edit} only={state.wallets.length === 1} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditWallet({ wallet, only, onClose }: { wallet: { id: string; name: string }; only: boolean; onClose: () => void }) {
  const { client } = useWallet();
  const [name, setName] = useState(wallet.name);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title={removing ? `Remove ${wallet.name}` : "Edit wallet"} onClose={onClose}>
      {removing ? (
        <>
          <p className="muted">
            This browser forgets the wallet. Its coins stay on the chain: its 24 words restore it here or in ZSilent or
            ZKAPriv. Without them it cannot come back.
          </p>
          <button type="button" className="btn danger block" onClick={() => client.removeWallet(wallet.id).then(onClose, (e: Error) => setError(e.message))}>
            Remove it from this browser
          </button>
          {error && <p className="error">{error}</p>}
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
            {(id) => <input id={id} className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <button type="submit" className="btn primary block" disabled={!name.trim()}>
            Save
          </button>
          {!only && (
            <button type="button" className="btn danger block" onClick={() => setRemoving(true)}>
              Remove from this browser
            </button>
          )}
        </form>
      )}
    </Sheet>
  );
}

function NameStep({
  title,
  initial,
  error,
  busy,
  onBack,
  onDone,
}: {
  title: string;
  initial: string;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  if (busy) return <Working title="Adding the wallet" />;
  return (
    <div className="screen plain">
      <Header title={title} onBack={onBack} />
      <form
        className="stack mt"
        onSubmit={(e) => {
          e.preventDefault();
          onDone(name);
        }}
      >
        <Field label="Wallet name" error={error} hint="Only you see it.">
          {(id) => <input id={id} className="input" value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} />}
        </Field>
        <button type="submit" className="btn primary block">
          Add wallet
        </button>
      </form>
    </div>
  );
}

function Phrase({ onBack }: { onBack: () => void }) {
  const { client, state } = useWallet();
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (busy) return <Working title="Checking the password" />;
  return (
    <div className="screen">
      <Header title="Recovery words" onBack={onBack} />
      {phrase ? (
        <div className="stack mt">
          <p className="muted">
            The 24 words of {state?.wallet?.name}. Anyone who sees them can spend this wallet: never share them, never
            type them into another site.
          </p>
          <ol className="words" aria-label="Recovery words">
            {phrase.split(" ").map((word, i) => (
              <li className="word" key={i}>
                <small>{i + 1}</small>
                <span>{word}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="btn block" onClick={() => setPhrase(null)}>
            Hide them
          </button>
        </div>
      ) : (
        <form
          className="stack mt"
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
            {(id) => <PasswordInput id={id} value={password} onChange={(v) => { setError(null); setPassword(v); }} autoComplete="current-password" autoFocus />}
          </Field>
          <button type="submit" className="btn primary block" disabled={!password}>
            Show the words
          </button>
        </form>
      )}
    </div>
  );
}

function ViewKey({ onBack }: { onBack: () => void }) {
  const { client } = useWallet();
  const [key, setKey] = useState<string | null>(null);
  return (
    <div className="screen">
      <Header title="View key" onBack={onBack} />
      <div className="stack mt">
        <p className="muted">
          The view key shows this wallet's balance and payments, for example in ZokaScan, and cannot spend. Whoever has
          it sees every payment of the wallet: share it only with someone who should.
        </p>
        {key ? (
          <>
            <div className="address-box">
              <p className="mono" style={{ maxHeight: 180, overflow: "auto", fontSize: 11 }}>
                {key}
              </p>
            </div>
            <CopyButton text={key} label="Copy view key" />
          </>
        ) : (
          <button type="button" className="btn block" onClick={() => client.viewKey().then(setKey)}>
            Show the view key
          </button>
        )}
      </div>
    </div>
  );
}

function ChangePassword({ onBack }: { onBack: () => void }) {
  const { client } = useWallet();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ready = current && next.length >= MIN_PASSWORD && next === repeat;
  if (busy) return <Working title="Sealing everything again" detail="With the new password." />;
  if (done) {
    return (
      <div className="screen">
        <div className="working">
          <span className="done-mark">
            <Icon name="check" />
          </span>
          <p className="title">Password changed</p>
        </div>
        <button type="button" className="btn primary block" onClick={onBack}>
          Done
        </button>
      </div>
    );
  }
  return (
    <div className="screen">
      <Header title="Password" onBack={onBack} />
      <form
        className="stack mt"
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
          {(id) => <PasswordInput id={id} value={current} onChange={(v) => { setError(null); setCurrent(v); }} autoComplete="current-password" />}
        </Field>
        <Field label="New password" error={next && next.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters` : null}>
          {(id) => <PasswordInput id={id} value={next} onChange={setNext} autoComplete="new-password" />}
        </Field>
        <Field label="Repeat the new password" error={repeat && repeat !== next ? "The passwords are different" : null}>
          {(id) => <PasswordInput id={id} value={repeat} onChange={setRepeat} autoComplete="new-password" />}
        </Field>
        <button type="submit" className="btn primary block" disabled={!ready}>
          Change password
        </button>
      </form>
    </div>
  );
}
