import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./ui/App";
import { WalletProvider } from "./ui/context";
import { workerClient } from "./worker/client";

// One Worker holds the wallet for this tab.
const worker = new Worker(new URL("./worker/wallet.worker.ts", import.meta.url), { type: "module", name: "zoka-wallet" });
const client = workerClient(worker);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletProvider client={client}>
      <App />
    </WalletProvider>
  </StrictMode>,
);
