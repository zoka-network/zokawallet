import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// The wallet is a static site: everything it runs ships in dist/, and the only
// other origin it talks to is the node's public API (see public/_headers).
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: "es2022",
    sourcemap: false,
    // The WebAssembly and the fonts stay files of their own: nothing is
    // inlined as a data: URL, which the Content-Security-Policy refuses.
    assetsInlineLimit: 0,
  },
  worker: { format: "es" },
  server: { port: 8090 },
  preview: { port: 8091 },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 60_000,
  },
});
