import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CoreState } from "../core/wallet-core";
import type { WalletClient } from "../worker/client";

interface WalletContextValue {
  client: WalletClient;
  state: CoreState | null;
  fatal: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ client, children }: { client: WalletClient; children: ReactNode }) {
  const [state, setState] = useState<CoreState | null>(client.current());
  const [fatal, setFatal] = useState<string | null>(client.fatal());
  useEffect(() => {
    const stop = client.subscribe((next) => {
      setState(next);
      setFatal(client.fatal());
    });
    client.init().then(setState, (error: Error) => setFatal(error.message));
    return () => {
      stop();
    };
  }, [client]);
  return <WalletContext.Provider value={{ client, state, fatal }}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet outside WalletProvider");
  return value;
}
