import type { ReactNode } from "react";
import { EXPLORER, NETWORK_NAME, SITE, SOURCE } from "../config";

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
