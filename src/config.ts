// What this build of the wallet talks to and how it keeps its secrets.

/** The node's public API (seed2, behind the Cloudflare tunnel). */
export const API = "https://api.zokascan.cc";
export const EXPLORER = "https://zokascan.cc";
export const SITE = "https://zoka.network";
export const SOURCE = "https://github.com/zoka-network/zokawallet";
// The same networks, in the same order, as the footer of zoka.network.
export const GITHUB = "https://github.com/zoka-network";
export const X = "https://x.com/zokanetwork";
export const DISCORD = "https://discord.gg/uZRPcNb3m7";

/** Zoka Quantic Testnet v2: the only network a web wallet follows today. */
export const NETWORK = 2;
export const NETWORK_NAME = "Zoka Quantic Testnet";

/** 1 ZKA = 1,000,000 atoms. */
export const DECIMALS = 6;
export const ATOMS = 10n ** BigInt(DECIMALS);
export const MAX_SUPPLY_ATOMS = 23_000_000n * ATOMS;
/** Memo bytes a payment carries (UTF-8). */
export const MEMO_BYTES = 512;

/**
 * Argon2id for the key that seals the recovery words: 64 MiB and three passes,
 * well above OWASP's floor (19 MiB, two passes). About a second in a browser.
 */
export const KDF = { memoryKib: 64 * 1024, iterations: 3 } as const;
export const MIN_PASSWORD = 10;

/** Locked after this long without a click or a key. */
export const AUTO_LOCK_MINUTES = 10;
/** How often an open wallet asks the node whether there is a new block. */
export const POLL_MS = 20_000;
/** Blocks per scan page (the node's maximum). */
export const PAGE_BLOCKS = 100;
/** How often the signed checkpoint is read again. */
export const CHECKPOINT_EVERY_MS = 5 * 60_000;
