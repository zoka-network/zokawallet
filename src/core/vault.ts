// The vault: what this browser keeps of each wallet, in IndexedDB, sealed with
// AES-256-GCM under a key that Argon2id derives from the password. The
// recovery words, the names and what the wallet read of the chain are all
// sealed; only random ids and the order of the wallets are not. Each sealed
// blob names its purpose and wallet in the AES-GCM associated data, so blobs
// cannot be swapped between wallets or roles.

export interface Sealed {
  iv: Uint8Array;
  data: Uint8Array;
}

export interface KdfParams {
  memoryKib: number;
  iterations: number;
  salt: Uint8Array;
}

export interface VaultHeader {
  version: 1;
  kdf: KdfParams;
  /** A known text sealed with the key: tells a wrong password apart. */
  check: Sealed;
  created: number;
}

export interface WalletRecord {
  id: string;
  order: number;
  /** A sealed {@link WalletSecret}. */
  secret: Sealed;
}

export interface StateRecord {
  id: string;
  state: Sealed;
}

export interface WalletSecret {
  name: string;
  phrase: string;
  created: number;
  /** Its short address resolves at the public node. */
  published: boolean;
}

export class VaultError extends Error {}

const DB_NAME = "zokawallet";
const DB_VERSION = 1;
const CHECK_TEXT = "zokawallet vault v1";

export const aad = {
  check: "zokawallet/v1/check",
  secret: (id: string) => `zokawallet/v1/wallet/${id}/secret`,
  state: (id: string) => `zokawallet/v1/wallet/${id}/state`,
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A copy on a plain ArrayBuffer, which WebCrypto takes. */
const plain = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function randomId(): string {
  return Array.from(randomBytes(12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The AES key, not extractable; the raw bytes are wiped once imported. */
export async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey("raw", plain(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
  } finally {
    raw.fill(0);
  }
}

export async function seal(key: CryptoKey, purpose: string, data: Uint8Array): Promise<Sealed> {
  const iv = randomBytes(12);
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(purpose) },
    key,
    plain(data),
  );
  return { iv, data: new Uint8Array(sealed) };
}

export async function unseal(key: CryptoKey, purpose: string, sealed: Sealed): Promise<Uint8Array> {
  try {
    const data = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: plain(sealed.iv), additionalData: encoder.encode(purpose) },
      key,
      plain(sealed.data),
    );
    return new Uint8Array(data);
  } catch {
    throw new VaultError("The password is wrong, or this browser's copy of the wallet is damaged");
  }
}

export const sealCheck = (key: CryptoKey) => seal(key, aad.check, encoder.encode(CHECK_TEXT));

export async function verifyCheck(key: CryptoKey, check: Sealed): Promise<boolean> {
  try {
    return decoder.decode(await unseal(key, aad.check, check)) === CHECK_TEXT;
  } catch {
    return false;
  }
}

export async function sealSecret(key: CryptoKey, id: string, secret: WalletSecret): Promise<Sealed> {
  return seal(key, aad.secret(id), encoder.encode(JSON.stringify(secret)));
}

export async function unsealSecret(key: CryptoKey, record: WalletRecord): Promise<WalletSecret> {
  const secret = JSON.parse(decoder.decode(await unseal(key, aad.secret(record.id), record.secret))) as WalletSecret;
  if (typeof secret.phrase !== "string" || typeof secret.name !== "string") {
    throw new VaultError("This browser's copy of the wallet is damaged");
  }
  return secret;
}

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new VaultError("The browser storage failed"));
  });

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new VaultError("The browser storage failed"));
  });

export interface VaultWrite {
  header?: VaultHeader;
  wallets?: WalletRecord[];
  states?: StateRecord[];
  remove?: string[];
  active?: string;
}

/** The IndexedDB side. Writes of one call land together or not at all. */
export class VaultStore {
  private constructor(private readonly db: IDBDatabase) {}

  static open(factory: IDBFactory = indexedDB, name = DB_NAME): Promise<VaultStore> {
    return new Promise((resolve, reject) => {
      const req = factory.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("vault")) db.createObjectStore("vault");
        if (!db.objectStoreNames.contains("wallets")) db.createObjectStore("wallets", { keyPath: "id" });
        if (!db.objectStoreNames.contains("states")) db.createObjectStore("states", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(new VaultStore(req.result));
      req.onerror = () => reject(req.error ?? new VaultError("This browser does not allow storing the wallet"));
      req.onblocked = () => reject(new VaultError("Close the wallet's other tabs and try again"));
    });
  }

  async header(): Promise<VaultHeader | undefined> {
    const tx = this.db.transaction("vault", "readonly");
    return request(tx.objectStore("vault").get("header") as IDBRequest<VaultHeader | undefined>);
  }

  async active(): Promise<string | undefined> {
    const tx = this.db.transaction("vault", "readonly");
    return request(tx.objectStore("vault").get("active") as IDBRequest<string | undefined>);
  }

  async wallets(): Promise<WalletRecord[]> {
    const tx = this.db.transaction("wallets", "readonly");
    const all = await request(tx.objectStore("wallets").getAll() as IDBRequest<WalletRecord[]>);
    return all.sort((a, b) => a.order - b.order);
  }

  async state(id: string): Promise<StateRecord | undefined> {
    const tx = this.db.transaction("states", "readonly");
    return request(tx.objectStore("states").get(id) as IDBRequest<StateRecord | undefined>);
  }

  async states(): Promise<StateRecord[]> {
    const tx = this.db.transaction("states", "readonly");
    return request(tx.objectStore("states").getAll() as IDBRequest<StateRecord[]>);
  }

  async write(change: VaultWrite): Promise<void> {
    const tx = this.db.transaction(["vault", "wallets", "states"], "readwrite");
    const vault = tx.objectStore("vault");
    const wallets = tx.objectStore("wallets");
    const states = tx.objectStore("states");
    if (change.header) vault.put(change.header, "header");
    if (change.active !== undefined) vault.put(change.active, "active");
    for (const record of change.wallets ?? []) wallets.put(record);
    for (const record of change.states ?? []) states.put(record);
    for (const id of change.remove ?? []) {
      wallets.delete(id);
      states.delete(id);
    }
    await done(tx);
  }

  /** Every wallet of this browser, gone. */
  async destroy(): Promise<void> {
    const tx = this.db.transaction(["vault", "wallets", "states"], "readwrite");
    tx.objectStore("vault").clear();
    tx.objectStore("wallets").clear();
    tx.objectStore("states").clear();
    await done(tx);
  }

  close(): void {
    this.db.close();
  }
}
