import { useEffect, useId, useState, type ReactNode } from "react";
import { useWallet } from "./context";

// Icons: plain strokes, drawn here (no icon font, nothing from elsewhere).
const paths: Record<string, ReactNode> = {
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M16 12.5h2M3 9h15a3 3 0 0 0-3-3H6" />
    </>
  ),
  send: <path d="M7 17 17 7M9 7h8v8" />,
  receive: <path d="M17 7 7 17M15 17H7V9" />,
  activity: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </>
  ),
  scan: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M7 12h10" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  back: <path d="m15 6-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  mined: <path d="M14.5 4.5 19.5 9.5M17 7 7 17l-2.5-2.5L14.5 4.5M4.5 19.5l3-3" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 21 19.5H3L12 4Z" />
      <path d="M12 10v4.5M12 17v.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  light: <path d="M9.5 18h5M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, title }: { name: IconName; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {paths[name]}
    </svg>
  );
}

export function Back({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="icon-btn back" onClick={onClick} aria-label={label}>
      <Icon name="back" />
    </button>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="top">
      <div className="row grow">
        {onBack && <Back onClick={onBack} />}
        <h1 className="title">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function CopyButton({ text, label = "Copy", small = false }: { text: string; label?: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1_800);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className={`btn${small ? " small" : ""}`}
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined)}
    >
      <Icon name={copied ? "check" : "copy"} />
      {copied ? "Copied" : label}
    </button>
  );
}

/** A QR code drawn as SVG from the matrix the WebAssembly makes. */
export function Qr({ text, label }: { text: string; label: string }) {
  const { client } = useWallet();
  const [matrix, setMatrix] = useState<Uint8Array | null>(null);
  useEffect(() => {
    let live = true;
    client.qr(text).then((m) => live && setMatrix(m), () => live && setMatrix(null));
    return () => {
      live = false;
    };
  }, [client, text]);
  if (!matrix) return <div className="qr" style={{ aspectRatio: "1" }} aria-busy="true" />;
  const width = matrix[0]!;
  const quiet = 2;
  let d = "";
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      if (matrix[1 + y * width + x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  const size = width + quiet * 2;
  return (
    <div className="qr">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
        <path d={d} fill="#000" />
      </svg>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  right,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  right?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <div className="field-head">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        {right}
      </div>
      {children(id)}
      {error ? <p className="error" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="input-wrap">
      <input
        id={id}
        className="input"
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={false}
        autoCapitalize="off"
      />
      <button type="button" className="icon-btn" onClick={() => setShown(!shown)} aria-label={shown ? "Hide password" : "Show password"}>
        <Icon name="eye" />
      </button>
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="veil" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 className="title" style={{ fontSize: 21 }}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="stack mt">{children}</div>
      </div>
    </div>
  );
}

export function Working({ title, detail }: { title: string; detail?: ReactNode }) {
  return (
    <div className="working" role="status" aria-live="polite">
      <div className="spinner" />
      <p className="title" style={{ fontSize: 21 }}>
        {title}
      </p>
      {detail && <p className="muted">{detail}</p>}
    </div>
  );
}

/** Seconds since a moment, ticking. */
export function useElapsed(running: boolean): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [running]);
  return Math.floor((now - start) / 1000);
}
