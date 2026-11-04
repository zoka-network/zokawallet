import { useEffect, useMemo, useState } from "react";
import { MIN_PASSWORD, NETWORK_NAME, SITE, SOURCE } from "../config";
import { Field, Header, Icon, PasswordInput, Sheet, Working } from "./components";
import { useWallet } from "./context";

// Creating, restoring and unlocking. A new wallet's 24 words are shown once,
// three of them are asked back, and a password seals them in this browser.

export function TestnetNotice() {
  return (
    <p className="notice">
      This is the {NETWORK_NAME}: its ZKA have no value. The wallet runs in this page, so it is only as safe as this
      browser and the code this site serves. For larger amounts use ZSilent or ZKAPriv.
    </p>
  );
}

function Words({ phrase }: { phrase: string }) {
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

export function WordsStep({ phrase, onNext, onBack }: { phrase: string; onNext: () => void; onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="screen plain">
      <Header title="Your recovery words" onBack={onBack} />
      <div className="stack mt">
        <p className="muted">
          Write these 24 words on paper, in order. They are the wallet: with them it comes back on any device, and
          anyone who sees them can spend it. They are never sent anywhere.
        </p>
        <Words phrase={phrase} />
        <label className="row" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} style={{ marginTop: 4 }} />
          <span>I wrote them down and keep them somewhere safe.</span>
        </label>
        <button type="button" className="btn primary block" disabled={!saved} onClick={onNext}>
          Continue
        </button>
      </div>
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
    <div className="screen plain">
      <Header title="Check your words" onBack={onBack} />
      <form
        className="stack mt"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <p className="muted">Type these words from your paper.</p>
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
                onChange={(e) => {
                  setError(null);
                  setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)));
                }}
              />
            )}
          </Field>
        ))}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn primary block" disabled={answers.some((a) => !a.trim())}>
          Continue
        </button>
      </form>
    </div>
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
    <div className="screen plain">
      <Header title="Restore a wallet" onBack={onBack} />
      <form
        className="stack mt"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="muted">The 24 words from ZSilent, ZKAPriv or this wallet, in order, separated by spaces.</p>
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
              onChange={(e) => {
                setError(null);
                setText(e.target.value);
              }}
            />
          )}
        </Field>
        <button type="submit" className="btn primary block" disabled={count === 0}>
          Continue
        </button>
      </form>
    </div>
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
    <div className="screen plain">
      <Header title="Set a password" onBack={onBack} />
      <form
        className="stack mt"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onDone(password, name);
        }}
      >
        <p className="muted">
          The password seals your words in this browser and opens the wallet here. It cannot be recovered: if you
          forget it, restore the wallet with your 24 words.
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
        <button type="submit" className="btn primary block" disabled={!ready}>
          Create wallet
        </button>
      </form>
    </div>
  );
}

type Flow = { step: "welcome" } | { step: "words" | "confirm"; phrase: string } | { step: "restore" } | { step: "password"; phrase: string; from: "confirm" | "restore" };

export function Welcome() {
  const { client, state } = useWallet();
  const [flow, setFlow] = useState<Flow>({ step: "welcome" });
  const [error, setError] = useState<string | null>(null);
  const busy = state?.busy === "creating";

  if (flow.step === "words") {
    return <WordsStep phrase={flow.phrase} onBack={() => setFlow({ step: "welcome" })} onNext={() => setFlow({ step: "confirm", phrase: flow.phrase })} />;
  }
  if (flow.step === "confirm") {
    return (
      <ConfirmStep
        phrase={flow.phrase}
        onBack={() => setFlow({ step: "words", phrase: flow.phrase })}
        onNext={() => setFlow({ step: "password", phrase: flow.phrase, from: "confirm" })}
      />
    );
  }
  if (flow.step === "restore") {
    return <RestoreStep onBack={() => setFlow({ step: "welcome" })} onNext={(phrase) => setFlow({ step: "password", phrase, from: "restore" })} />;
  }
  if (flow.step === "password") {
    return (
      <PasswordStep
        busy={busy}
        error={error}
        onBack={() => setFlow(flow.from === "restore" ? { step: "restore" } : { step: "confirm", phrase: flow.phrase })}
        onDone={(password, name) => {
          setError(null);
          client.create(password, name, flow.phrase).catch((e: Error) => setError(e.message));
        }}
      />
    );
  }
  return (
    <div className="screen plain">
      <div className="hero">
        <img src="/zoka-icon.png" alt="" />
        <h1 className="title">Zoka Web Wallet</h1>
        <p>Private payments on {NETWORK_NAME}. Your recovery words, balance and payment proofs stay in this browser.</p>
      </div>
      <div className="stack">
        <button type="button" className="btn primary block" onClick={() => client.newPhrase().then((phrase) => setFlow({ step: "words", phrase }))}>
          Create a wallet
        </button>
        <button type="button" className="btn block" onClick={() => setFlow({ step: "restore" })}>
          Restore with 24 words
        </button>
      </div>
      <div className="mt">
        <TestnetNotice />
      </div>
      <nav className="footer-links" aria-label="Zoka">
        <a href={SITE}>zoka.network</a>
        <a href="https://zokascan.cc">ZokaScan</a>
        <a href={SOURCE}>Source code</a>
      </nav>
    </div>
  );
}

export function Unlock() {
  const { client, state } = useWallet();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forget, setForget] = useState(false);
  const busy = state?.busy === "unlocking";
  useEffect(() => setError(null), [password]);
  if (busy) return <Working title="Opening your wallet" detail="Deriving the key from your password…" />;
  return (
    <div className="screen plain">
      <div className="hero">
        <img src="/zoka-icon.png" alt="" />
        <h1 className="title">Welcome back</h1>
        <p>Enter your password to open the wallets of this browser.</p>
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          client.unlock(password).catch((err: Error) => setError(err.message));
        }}
      >
        <Field label="Password" error={error}>
          {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="current-password" autoFocus />}
        </Field>
        <button type="submit" className="btn primary block" disabled={!password}>
          <Icon name="lock" />
          Unlock
        </button>
        <button type="button" className="link center" onClick={() => setForget(true)}>
          Forgot the password?
        </button>
      </form>
      {forget && <ForgetSheet onClose={() => setForget(false)} />}
    </div>
  );
}

export function ForgetSheet({ onClose }: { onClose: () => void }) {
  const { client } = useWallet();
  const [typed, setTyped] = useState("");
  return (
    <Sheet title="Forget this browser’s wallets" onClose={onClose}>
      <p className="muted">
        This deletes every wallet stored in this browser. The coins are not lost: restore each wallet with its 24
        words, here or in ZSilent or ZKAPriv. Without the words, they cannot be recovered.
      </p>
      <Field label="Type FORGET to confirm">
        {(id) => <input id={id} className="input" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />}
      </Field>
      <button type="button" className="btn danger block" disabled={typed.trim().toUpperCase() !== "FORGET"} onClick={() => client.forgetAll().then(onClose)}>
        Forget all wallets here
      </button>
    </Sheet>
  );
}
