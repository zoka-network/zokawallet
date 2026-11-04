import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MIN_PASSWORD, NETWORK_NAME } from "../config";
import { PublicFrame } from "./Frame";
import { Dialog, Field, Icon, PasswordInput, Working } from "./components";
import { useWallet } from "./context";

// Creating, restoring and unlocking. A new wallet's 24 words are shown once,
// three of them are asked back, and a password seals them in this browser.
// The steps are bodies without a frame: the sign-in page puts them in its
// panel, and Settings in a window when a wallet is added.

export function TestnetNotice() {
  return (
    <p className="notice">
      This is the {NETWORK_NAME}: its ZKA have no value. The wallet runs in this page, so it is only as safe as this
      browser and the code this site serves. For larger amounts use ZSilent or ZKAPriv.
    </p>
  );
}

export function Words({ phrase }: { phrase: string }) {
  return (
    <ol className="words" aria-label="Recovery words">
      {phrase.split(" ").map((word, i) => (
        <li className="word" key={i}>
          <small>{i + 1}</small>
          <span>{word}</span>
        </li>
      ))}
    </ol>
  );
}

function StepActions({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div className="actions">
      {onBack && (
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
      )}
      {children}
    </div>
  );
}

export function WordsStep({ phrase, onNext, onBack }: { phrase: string; onNext: () => void; onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="stack">
      <p className="muted">
        Write these 24 words on paper, in order. They are the wallet: with them it comes back on any device, and anyone
        who sees them can spend it. They are never sent anywhere.
      </p>
      <Words phrase={phrase} />
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I wrote them down and keep them somewhere safe.</span>
      </label>
      <StepActions onBack={onBack}>
        <button type="button" className="btn primary wide" disabled={!saved} onClick={onNext}>
          Continue
        </button>
      </StepActions>
    </div>
  );
}

function pickPositions(): number[] {
  const picked = new Set<number>();
  const random = new Uint32Array(8);
  while (picked.size < 3) {
    crypto.getRandomValues(random);
    for (const n of random) {
      if (picked.size < 3) picked.add(n % 24);
    }
  }
  return [...picked].sort((a, b) => a - b);
}

export function ConfirmStep({ phrase, onNext, onBack }: { phrase: string; onNext: () => void; onBack: () => void }) {
  const words = phrase.split(" ");
  const positions = useMemo(pickPositions, []);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const check = () => {
    const right = positions.every((p, i) => answers[i]!.trim().toLowerCase() === words[p]);
    if (right) onNext();
    else setError("One of the words does not match. Look at your paper again.");
  };
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        check();
      }}
    >
      <p className="muted">Type these three words from your paper.</p>
      {positions.map((p, i) => (
        <Field key={p} label={`Word ${p + 1}`}>
          {(id) => (
            <input
              id={id}
              className="input"
              value={answers[i]}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus={i === 0}
              onChange={(e) => {
                setError(null);
                setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)));
              }}
            />
          )}
        </Field>
      ))}
      {error && <p className="error" role="alert">{error}</p>}
      <StepActions onBack={onBack}>
        <button type="submit" className="btn primary wide" disabled={answers.some((a) => !a.trim())}>
          Continue
        </button>
      </StepActions>
    </form>
  );
}

export function RestoreStep({ onNext, onBack }: { onNext: (phrase: string) => void; onBack: () => void }) {
  const { client } = useWallet();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const submit = async () => {
    const phrase = text.trim().toLowerCase().split(/\s+/).join(" ");
    if (await client.validPhrase(phrase)) onNext(phrase);
    else setError(count === 24 ? "Those words do not form a valid recovery phrase. Check each one." : "Enter all 24 words.");
  };
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="muted">The 24 words from ZSilent, ZKAPriv or this wallet, in order, separated by spaces. The same words open the same wallet.</p>
      <Field label="Recovery words" error={error} right={<span className="hint">{count} of 24</span>}>
        {(id) => (
          <textarea
            id={id}
            className="textarea"
            rows={5}
            value={text}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
            onChange={(e) => {
              setError(null);
              setText(e.target.value);
            }}
          />
        )}
      </Field>
      <StepActions onBack={onBack}>
        <button type="submit" className="btn primary wide" disabled={count === 0}>
          Continue
        </button>
      </StepActions>
    </form>
  );
}

export function PasswordStep({
  onDone,
  onBack,
  busy,
  error,
}: {
  onDone: (password: string, name: string) => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const short = password.length > 0 && password.length < MIN_PASSWORD;
  const differ = repeat.length > 0 && repeat !== password;
  const ready = password.length >= MIN_PASSWORD && repeat === password;
  if (busy) return <Working title="Sealing your wallet" detail="Deriving the key from your password…" />;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onDone(password, name);
      }}
    >
      <p className="muted">
        The password seals your words in this browser and opens the wallet here. It cannot be recovered: if you forget
        it, restore the wallet with your 24 words.
      </p>
      <Field label="Wallet name" hint="Only you see it.">
        {(id) => <input id={id} className="input" value={name} placeholder="Wallet" maxLength={40} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="Password" error={short ? `At least ${MIN_PASSWORD} characters` : null}>
        {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="new-password" />}
      </Field>
      <Field label="Repeat the password" error={differ ? "The passwords are different" : null}>
        {(id) => <PasswordInput id={id} value={repeat} onChange={setRepeat} autoComplete="new-password" />}
      </Field>
      {error && <p className="error" role="alert">{error}</p>}
      <StepActions onBack={onBack}>
        <button type="submit" className="btn primary wide" disabled={!ready}>
          Create wallet
        </button>
      </StepActions>
    </form>
  );
}

/** The sign-in page: what this is on the left, the panel with the steps on the right. */
function AuthPage({
  compact,
  wide,
  step,
  label = "Get started",
  children,
}: {
  compact: boolean;
  wide?: boolean;
  step?: { at: number; of: number; name: string };
  label?: string;
  children: ReactNode;
}) {
  return (
    <PublicFrame>
      <main className={`auth${compact ? " compact" : ""}${wide ? " wide" : ""}`}>
        <section className="auth-intro">
          <p className="eyebrow">{NETWORK_NAME} · Web wallet</p>
          <h1 className="title">
            A private wallet that lives <em>in your browser.</em>
          </h1>
          <p className="lede">
            Your recovery words, balance and payment proofs never leave this page. The node it reads from serves the
            same pages of the chain to every wallet, so it cannot tell which one is yours.
          </p>
        </section>
        <section className="auth-more" aria-label="About this wallet">
          <div className="stats auth-facts">
            <div className="stat">
              <p className="label">Keys</p>
              <p className="stat-value">Sealed here</p>
              <p className="stat-hint">AES-256-GCM, with a key from your password (Argon2id)</p>
            </div>
            <div className="stat">
              <p className="label">Proofs</p>
              <p className="stat-value">Made here</p>
              <p className="stat-hint">Each payment is a STARK proof built in this tab</p>
            </div>
            <div className="stat">
              <p className="label">Same words</p>
              <p className="stat-value">Any app</p>
              <p className="stat-hint">The 24 words also open it in ZSilent and ZKAPriv</p>
            </div>
          </div>
          <TestnetNotice />
        </section>
        <section className="panel" aria-label={step ? `Step ${step.at} of ${step.of}: ${step.name}` : label}>
          <div className="panel-head">
            <span className="label">{step ? `Step ${step.at} of ${step.of}` : label}</span>
            {step && <span className="label" style={{ color: "var(--pink)" }}>{step.name}</span>}
          </div>
          {step && (
            <div className="steps" aria-hidden="true" style={{ paddingTop: 14 }}>
              {Array.from({ length: step.of }, (_, i) => (
                <i key={i} className={i < step.at ? "on" : ""} />
              ))}
            </div>
          )}
          <div className="panel-body stack">{children}</div>
        </section>
      </main>
    </PublicFrame>
  );
}

type Flow =
  | { step: "welcome" }
  | { step: "words" | "confirm"; phrase: string }
  | { step: "restore" }
  | { step: "password"; phrase: string; from: "confirm" | "restore" };

export function Welcome() {
  const { client, state } = useWallet();
  const [flow, setFlow] = useState<Flow>({ step: "welcome" });
  const [error, setError] = useState<string | null>(null);
  const busy = state?.busy === "creating";

  if (flow.step === "words") {
    return (
      <AuthPage compact wide step={{ at: 1, of: 3, name: "Recovery words" }}>
        <h2 className="step-title">Your recovery words</h2>
        <WordsStep phrase={flow.phrase} onBack={() => setFlow({ step: "welcome" })} onNext={() => setFlow({ step: "confirm", phrase: flow.phrase })} />
      </AuthPage>
    );
  }
  if (flow.step === "confirm") {
    return (
      <AuthPage compact step={{ at: 2, of: 3, name: "Check" }}>
        <h2 className="step-title">Check your words</h2>
        <ConfirmStep
          phrase={flow.phrase}
          onBack={() => setFlow({ step: "words", phrase: flow.phrase })}
          onNext={() => setFlow({ step: "password", phrase: flow.phrase, from: "confirm" })}
        />
      </AuthPage>
    );
  }
  if (flow.step === "restore") {
    return (
      <AuthPage compact step={{ at: 1, of: 2, name: "Recovery words" }}>
        <h2 className="step-title">Restore a wallet</h2>
        <RestoreStep onBack={() => setFlow({ step: "welcome" })} onNext={(phrase) => setFlow({ step: "password", phrase, from: "restore" })} />
      </AuthPage>
    );
  }
  if (flow.step === "password") {
    const restoring = flow.from === "restore";
    return (
      <AuthPage compact step={{ at: restoring ? 2 : 3, of: restoring ? 2 : 3, name: "Password" }}>
        {!busy && <h2 className="step-title">Set a password</h2>}
        <PasswordStep
          busy={busy}
          error={error}
          onBack={() => setFlow(restoring ? { step: "restore" } : { step: "confirm", phrase: flow.phrase })}
          onDone={(password, name) => {
            setError(null);
            client.create(password, name, flow.phrase).catch((e: Error) => setError(e.message));
          }}
        />
      </AuthPage>
    );
  }
  return (
    <AuthPage compact={false}>
      <h2 className="step-title">Open a wallet in this browser</h2>
      <p className="muted">Create a new one, or bring one you already have with its 24 words.</p>
      <button type="button" className="btn primary block" onClick={() => client.newPhrase().then((phrase) => setFlow({ step: "words", phrase }))}>
        <Icon name="plus" />
        Create a wallet
      </button>
      <button type="button" className="btn block" onClick={() => setFlow({ step: "restore" })}>
        <Icon name="key" />
        Restore with 24 words
      </button>
      <p className="hint">
        A password seals the wallet in this browser. Several wallets can live here, all opened with the same password.
      </p>
    </AuthPage>
  );
}

export function Unlock() {
  const { client, state } = useWallet();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forget, setForget] = useState(false);
  const busy = state?.busy === "unlocking";
  useEffect(() => setError(null), [password]);
  return (
    <AuthPage compact label="Unlock">
      {busy ? (
        <Working title="Opening your wallet" detail="Deriving the key from your password…" />
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            client.unlock(password).catch((err: Error) => setError(err.message));
          }}
        >
          <h2 className="step-title">Welcome back</h2>
          <p className="muted">Enter your password to open the wallets of this browser.</p>
          <Field label="Password" error={error}>
            {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="current-password" autoFocus />}
          </Field>
          <button type="submit" className="btn primary block" disabled={!password}>
            <Icon name="lock" />
            Unlock
          </button>
          <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => setForget(true)}>
            Forgot the password?
          </button>
        </form>
      )}
      {forget && <ForgetDialog onClose={() => setForget(false)} />}
    </AuthPage>
  );
}

export function ForgetDialog({ onClose }: { onClose: () => void }) {
  const { client } = useWallet();
  const [typed, setTyped] = useState("");
  return (
    <Dialog title="Forget this browser’s wallets" onClose={onClose}>
      <p className="muted">
        This deletes every wallet stored in this browser. The coins are not lost: restore each wallet with its 24 words,
        here or in ZSilent or ZKAPriv. Without the words, they cannot be recovered.
      </p>
      <Field label="Type FORGET to confirm">
        {(id) => <input id={id} className="input" value={typed} autoComplete="off" autoFocus onChange={(e) => setTyped(e.target.value)} />}
      </Field>
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn danger" disabled={typed.trim().toUpperCase() !== "FORGET"} onClick={() => client.forgetAll().then(onClose)}>
          Forget all wallets here
        </button>
      </div>
    </Dialog>
  );
}
