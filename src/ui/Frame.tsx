import type { ReactNode } from "react";
import { DISCORD, EXPLORER, GITHUB, NETWORK_NAME, SITE, SOURCE, X } from "../config";

// The bar at the top and the footer, as in ZokaScan.

export function Brand({ onClick }: { onClick?: () => void }) {
  const inner = (
    <>
      <span className="brand-name">ZOKA WALLET</span>
      <span className="brand-net">{NETWORK_NAME}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="brand" onClick={onClick} aria-label="Zoka Wallet overview">
      {inner}
    </button>
  ) : (
    <a className="brand" href={SITE} aria-label="zoka.network">
      {inner}
    </a>
  );
}

/**
 * GitHub, X and Discord, drawn as on zoka.network. The GitHub and Discord
 * marks are Lucide's "github" and "message-circle" (0.462, ISC License,
 * Copyright (c) Lucide Contributors); the X mark is zoka.network's own.
 */
export function Socials() {
  const lucide = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  return (
    <div className="socials">
      <a href={GITHUB} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="social">
        <svg {...lucide}>
          <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
          <path d="M9 18c-4.51 2-5-2-7-2" />
        </svg>
      </a>
      <a href={X} target="_blank" rel="noopener noreferrer" aria-label="X / Twitter" className="social">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 3h4.5L20 21h-4.5L4 3Z" stroke="currentColor" strokeWidth="1.4" />
          <path d="m20 3-7 8M4 21l7-8" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </a>
      <a href={DISCORD} target="_blank" rel="noopener noreferrer" aria-label="Discord" className="social">
        <svg {...lucide}>
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      </a>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>
          Zoka Web Wallet {__APP_VERSION__} · {NETWORK_NAME} · test coins only
        </span>
        <nav aria-label="Zoka">
          <a href={SITE} target="_blank" rel="noopener noreferrer">
            zoka.network ↗
          </a>
          <a href={EXPLORER} target="_blank" rel="noopener noreferrer">
            ZokaScan ↗
          </a>
          <a href={SOURCE} target="_blank" rel="noopener noreferrer">
            Source code ↗
          </a>
          <a href="/SHA256SUMS.txt">Checksums</a>
        </nav>
        <Socials />
      </div>
    </footer>
  );
}

/** The frame of the pages before a wallet is open. */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <header className="site-header">
        <div className="site-nav">
          <Brand />
          <nav className="bar-links" aria-label="Zoka">
            <a href={SITE} target="_blank" rel="noopener noreferrer">
              zoka.network ↗
            </a>
            <a href={EXPLORER} target="_blank" rel="noopener noreferrer">
              ZokaScan ↗
            </a>
          </nav>
        </div>
      </header>
      {children}
      <SiteFooter />
    </div>
  );
}
