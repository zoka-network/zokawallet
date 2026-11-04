// End-to-end run of the built wallet in a real Chrome, against the live
// testnet API: create a wallet, read the chain, visit every tab, and watch
// what leaves the page. No dependencies: Chrome's DevTools protocol over the
// WebSocket that Node ships.
//
//   npm run build && node scripts/e2e-browser.mjs [out-dir]
//
// CHROME (path of chrome.exe) and E2E_WIDTH (default 1440; below 700 the page
// is a phone's) can be set. The wallet is a throwaway one: its words are typed
// by the script and never printed, and the screenshot of the words step blurs
// them.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2] ?? join(tmpdir(), "zokawallet-e2e");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const WIDTH = Number(process.env.E2E_WIDTH ?? 1440);
const PHONE = WIDTH < 700;
const SECTIONS = `nav[aria-label="Wallet sections"]`;
const PREVIEW = 8091;
const DEBUG = 9333 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const children = [];
function stopAll() {
  for (const child of children) {
    try {
      child.kill();
    } catch {}
  }
}
process.on("exit", stopAll);

async function waitHttp(url, ms = 30_000) {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch {}
    if (Date.now() > end) throw new Error(`no answer from ${url}`);
    await sleep(250);
  }
}

// The built site, with the headers Cloudflare sends (vite.config.ts).
const preview = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", String(PREVIEW), "--strictPort"], {
  stdio: "ignore",
});
children.push(preview);
await waitHttp(`http://localhost:${PREVIEW}/`);

// A Chrome of its own: another profile, no window, closed at the end.
const profile = mkdtempSync(join(tmpdir(), "zokawallet-chrome-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    `--window-size=${WIDTH},800`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
children.push(chrome);
const version = await (await waitHttp(`http://127.0.0.1:${DEBUG}/json/version`)).json();

// ---- a small DevTools client --------------------------------------------
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let nextId = 1;
const pending = new Map();
const listeners = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
  } else if (msg.method) {
    listeners.forEach((l) => l(msg));
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const page = (method, params) => send(method, params, sessionId);

// What leaves the page, from every frame and the Worker.
const requests = [];
const problems = [];
listeners.push((msg) => {
  const p = msg.params ?? {};
  if (msg.method === "Network.requestWillBeSent") {
    requests.push({ method: p.request.method, url: p.request.url, body: p.request.postData ?? "" });
  } else if (msg.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "warning")) {
    problems.push(`console.${p.type}: ${p.args.map((a) => a.value ?? a.description ?? "").join(" ")}`);
  } else if (msg.method === "Runtime.exceptionThrown") {
    problems.push(`exception: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`);
  } else if (msg.method === "Log.entryAdded" && (p.entry.level === "error" || p.entry.source === "security")) {
    problems.push(`log.${p.entry.source}: ${p.entry.text}`);
  } else if (msg.method === "Target.attachedToTarget" && p.targetInfo?.type === "worker") {
    // The Worker's own requests (pages, checkpoint, POSTs) and errors.
    send("Network.enable", {}, p.sessionId).catch(() => {});
    send("Runtime.enable", {}, p.sessionId).catch(() => {});
    send("Runtime.runIfWaitingForDebugger", {}, p.sessionId).catch(() => {});
  }
});
await page("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
await page("Network.enable");
await page("Runtime.enable");
await page("Log.enable");
await page("Page.enable");
await page("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: PHONE ? 800 : 900, deviceScaleFactor: PHONE ? 2 : 1, mobile: PHONE });
await page("Page.addScriptToEvaluateOnNewDocument", {
  source: `document.addEventListener("securitypolicyviolation", (e) => console.error("CSP violation", e.violatedDirective, e.blockedURI));`,
});

const evaluate = async (expression) => {
  const result = await page("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
  return result.result.value;
};
async function until(expression, ms = 30_000, what = expression) {
  const end = Date.now() + ms;
  for (;;) {
    if (await evaluate(expression).catch(() => false)) return;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(250);
  }
}
async function shot(name, whole = true) {
  // The whole page, not only what fits on the screen (windows: the screen).
  const { cssContentSize } = await page("Page.getLayoutMetrics");
  const clip = { x: 0, y: 0, width: WIDTH, height: Math.ceil(cssContentSize.height), scale: 1 };
  const { data } = await page("Page.captureScreenshot", whole ? { format: "png", captureBeyondViewport: true, clip } : { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`  screenshot ${name}.png`);
}
// Helpers that run in the page.
await page("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.__byText = (sel, text) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);
    window.__click = (sel, text) => { const el = window.__byText(sel, text); if (!el) throw new Error("no " + text); el.click(); return true; };
    window.__type = (el, value) => {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    };
    window.SECTIONS_SEL = ${JSON.stringify(SECTIONS)};
    window.__field = (label) => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === label); return l && document.getElementById(l.htmlFor); };
  `,
});

const t0 = Date.now();
const step = (text) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s] ${text}`);

try {
  step(`open http://localhost:${PREVIEW}/ at ${WIDTH} px`);
  await page("Page.navigate", { url: `http://localhost:${PREVIEW}/` });
  await until(`!!__byText("button", "Create a wallet")`, 30_000, "the welcome page");
  await shot("01-welcome");

  step("create a wallet");
  await evaluate(`__click("button", "Create a wallet")`);
  await until(`document.querySelectorAll(".words li").length === 24`, 10_000, "the 24 words");
  const words = await evaluate(`[...document.querySelectorAll(".words li span")].map((s) => s.textContent)`);
  // Blurred through the CSSOM: the page's CSP refuses an injected <style>.
  const blur = (on) => evaluate(`document.querySelectorAll(".word span").forEach((s) => (s.style.filter = ${on} ? "blur(7px)" : "")), true`);
  await blur(true);
  if (await evaluate(`[...document.querySelectorAll(".word span")].every((s) => s.style.filter.startsWith("blur"))`)) await shot("01b-words");
  await blur(false);
  await evaluate(`document.querySelector("input[type=checkbox]").click(), true`);
  await evaluate(`__click("button", "Continue")`);
  await until(`[...document.querySelectorAll("label")].filter((l) => /^Word \\d+$/.test(l.textContent)).length === 3`, 5_000, "the word check");
  await shot("01c-check");
  await evaluate(`(() => {
    const words = ${JSON.stringify(words)};
    for (const l of [...document.querySelectorAll("label")].filter((l) => /^Word \\d+$/.test(l.textContent))) {
      __type(document.getElementById(l.htmlFor), words[Number(l.textContent.slice(5)) - 1]);
    }
    return true;
  })()`);
  await evaluate(`__click("button", "Continue")`);
  await until(`!!__field("Wallet name")`, 5_000, "the password step");
  await evaluate(`__type(__field("Wallet name"), "E2E"), __type(__field("Password"), "e2e password 1234"), __type(__field("Repeat the password"), "e2e password 1234")`);
  await shot("02-password");
  await evaluate(`__click("button", "Create wallet")`);
  await until(`!!document.querySelector(SECTIONS_SEL)`, 30_000, "the wallet");
  step("wallet open");
  await shot("03-home-first");

  step("reading the chain");
  await until(`/Up to date/.test(document.querySelector(".status-line")?.textContent ?? "")`, 6 * 60_000, "the end of the first read");
  step(`read: ${await evaluate(`document.querySelector(".status-line").textContent`)}`);
  await sleep(1_500);
  await shot("04-overview");

  await evaluate(`document.querySelector(".wallet-button").click(), true`);
  await until(`!!document.querySelector("[role=menu]")`, 5_000, "the wallet menu");
  await shot("05-wallet-menu", false);
  await evaluate(`document.querySelector(".wallet-button").click(), true`);

  for (const [tab, name] of [
    ["Receive", "06-receive"],
    ["Activity", "07-activity"],
    ["Settings", "08-settings"],
  ]) {
    await evaluate(`__click(SECTIONS_SEL + " button", "${tab}")`);
    await sleep(700);
    await shot(name);
  }

  step("send: a wrong address and too many decimals");
  await evaluate(`__click(SECTIONS_SEL + " button", "Send")`);
  await until(`!!__field("To")`, 5_000, "the send form");
  await evaluate(`__type(__field("To"), "zqtest2nothing"), __type(__field("Amount"), "1.5")`);
  await evaluate(`__click("button", "Review")`);
  await until(`/not a Zoka Quantic Testnet address/.test(document.body.textContent)`, 10_000, "the address error");
  await shot("09-send-error");

  step("browser back button returns to the wallet");
  await evaluate(`history.back(), true`);
  await until(`document.querySelector(SECTIONS_SEL + " [aria-current=page]")?.textContent === "Overview"`, 5_000, "the overview after back");

  step("a window from Settings");
  await evaluate(`__click(SECTIONS_SEL + " button", "Settings")`);
  await sleep(300);
  await evaluate(`[...document.querySelectorAll(".setting")].find((li) => li.textContent.includes("Password")).querySelector("button").click(), true`);
  await until(`!!document.querySelector("[role=dialog]")`, 5_000, "the password window");
  await sleep(300);
  await shot("11-dialog", false);
  await evaluate(`document.querySelector("[aria-label=Close]").click(), true`);

  step("lock and unlock");
  await evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Lock now")).click(), true`);
  await until(`!!__byText("button", "Unlock")`, 5_000, "the lock screen");
  await evaluate(`__type(__field("Password"), "wrong password 99")`);
  await evaluate(`__click("button", "Unlock")`);
  await until(`/Wrong password/.test(document.body.textContent)`, 15_000, "the wrong password error");
  await shot("10-unlock-wrong");
  await evaluate(`__type(__field("Password"), "e2e password 1234")`);
  await evaluate(`__click("button", "Unlock")`);
  await until(`!!document.querySelector(SECTIONS_SEL)`, 20_000, "the wallet again");
  await until(`/Up to date/.test(document.querySelector(".status-line")?.textContent ?? "")`, 60_000, "the sync after unlock");
  step(`unlocked: ${await evaluate(`document.querySelector(".status-line").textContent`)}`);
  await sleep(4_000);

  // ---- what left the page ------------------------------------------------
  const origins = [...new Set(requests.map((r) => new URL(r.url).origin))];
  const pairs = words.slice(1).map((w, i) => `${words[i]} ${w}`);
  const leaked = requests.filter((r) => pairs.some((p) => r.url.includes(p) || r.body.includes(p)) || r.url.includes(words.join("%20")));
  const counts = {};
  for (const r of requests) {
    const u = new URL(r.url);
    const key = `${r.method} ${u.origin}${u.pathname}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  console.log("\nrequests by endpoint:");
  for (const [key, n] of Object.entries(counts).sort()) console.log(`  ${String(n).padStart(4)}  ${key}`);
  console.log(`origins: ${origins.join(", ")}`);
  console.log(`requests carrying the recovery words: ${leaked.length}`);
  console.log(`console errors, exceptions and CSP violations: ${problems.length}`);
  for (const p of problems) console.log(`  ${p}`);
  writeFileSync(join(OUT, "report.json"), JSON.stringify({ width: WIDTH, counts, origins, leaked: leaked.length, problems }, null, 2));
  const bad = origins.filter((o) => o !== `http://localhost:${PREVIEW}` && o !== "https://api.zokascan.cc");
  if (bad.length || leaked.length) {
    console.log(`FAIL: unexpected origins ${bad.join(", ")} or words leaked`);
    process.exitCode = 1;
  } else {
    console.log("OK");
  }
} catch (error) {
  console.log(`FAIL: ${error.message}`);
  await shot("99-failure").catch(() => {});
  for (const p of problems) console.log(`  ${p}`);
  process.exitCode = 1;
} finally {
  await send("Browser.close").catch(() => {});
  ws.close();
  stopAll();
}
