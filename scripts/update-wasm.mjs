// Copies the wallet's WebAssembly from a build of the node repository:
//
//   cd <ZOKA>/crates/zoka-pq-wallet-wasm
//   wasm-pack build --release --target web --out-dir pkg --no-pack
//   cd <zokawallet> && npm run update-wasm -- <ZOKA>
//
// and writes src/wasm/SOURCE.txt with the commit and the hashes, so a build of
// this site can be traced to the Rust code it runs.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.argv[2];
if (!repo) {
  console.error("usage: npm run update-wasm -- <path of the ZOKA node repository>");
  process.exit(1);
}
const pkg = join(repo, "crates", "zoka-pq-wallet-wasm", "pkg");
const target = new URL("../src/wasm/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const names = ["zoka_pq_wallet_wasm.js", "zoka_pq_wallet_wasm.d.ts", "zoka_pq_wallet_wasm_bg.wasm", "zoka_pq_wallet_wasm_bg.wasm.d.ts"];
for (const name of names) copyFileSync(join(pkg, name), join(target, name));

const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", "crates/zoka-pq-wallet-wasm", "crates/zoka-pq-pool", "crates/zoka-light");
const lines = [
  `commit ${git("rev-parse", "HEAD")}${dirty ? " (with uncommitted changes)" : ""}`,
  `branch ${git("rev-parse", "--abbrev-ref", "HEAD")}`,
  ...names.map((name) => `${createHash("sha256").update(readFileSync(join(target, name))).digest("hex")}  ${name}`),
];
writeFileSync(join(target, "SOURCE.txt"), `${lines.join("\n")}\n`);
console.log(lines.join("\n"));
