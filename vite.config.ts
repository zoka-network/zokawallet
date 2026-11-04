import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/**
 * The headers Cloudflare Pages sends for every page (public/_headers), for
 * `vite preview`: a local run meets the same Content-Security-Policy. Over
 * plain http it keeps requests on http and sends no HSTS.
 */
function pagesHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  let all = false;
  for (const line of readFileSync(new URL("./public/_headers", import.meta.url), "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      all = line.trim() === "/*";
      continue;
    }
    const at = line.indexOf(":");
    if (all && at > 0) headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  const csp = headers["Content-Security-Policy"];
  if (csp) headers["Content-Security-Policy"] = csp.replace(/;\s*upgrade-insecure-requests/, "");
  delete headers["Strict-Transport-Security"];
  return headers;
}

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
  preview: { port: 8091, headers: pagesHeaders() },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 60_000,
  },
});
