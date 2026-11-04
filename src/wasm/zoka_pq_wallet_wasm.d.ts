/* tslint:disable */
/* eslint-disable */

export class WebWallet {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Lee una página de `/scan2` (tiene que empezar en [`WebWallet::next`]);
     * devuelve la punta que tenía el servidor. Cada bloque se compara con su
     * cabecera: una página que esconde o inventa una salida se rechaza.
     */
    addPage(bytes: Uint8Array | number[]): number;
    /**
     * El registro de la dirección corta para `POST /address`, con su
     * estampilla Argon2id (unos segundos: llamarla en un Worker).
     */
    addressRecord(): string;
    /**
     * La dirección completa (unos 1.760 caracteres).
     */
    address(): string;
    /**
     * Verifica la firma del checkpoint (el JSON de `/checkpoint`) y confirma
     * lo leído contra él. `true` si esa altura ya se leyó.
     */
    confirmCheckpoint(json: string): boolean;
    /**
     * El estado leído, para guardarlo (cifrado) y seguir desde ahí.
     */
    encodeState(): Uint8Array;
    inSync(): boolean;
    /**
     * Los bytes del último pago probado, para `POST /transactions`.
     */
    lastTransaction(): Uint8Array;
    /**
     * `state`: lo que devolvió [`WebWallet::encode_state`] la última vez, o
     * vacío para leer la cadena desde el bloque 1.
     */
    constructor(phrase: string, network: number, state: Uint8Array | number[]);
    /**
     * La altura del próximo bloque que necesita: pedir `/scan2?from=<next>`.
     */
    next(): number;
    /**
     * Arma y prueba (STARK, segundos) un pago a la dirección completa `to`,
     * y reserva sus notas. Devuelve `{txid, amount_atoms, fee_atoms,
     * expiry}`; los bytes para `POST /transactions`, con
     * [`WebWallet::last_transaction`]. Si la red lo rechaza: [`WebWallet::release`].
     */
    prove(to: string, amount_atoms: bigint, memo: string): string;
    /**
     * La comisión de un pago de `amount_atoms`, o por qué no alcanza.
     */
    quote(amount_atoms: bigint): string;
    /**
     * La red rechazó el pago: sus notas vuelven a estar disponibles.
     */
    release(): void;
    /**
     * La dirección corta: la que se comparte y va en el QR.
     */
    shortAddress(): string;
    /**
     * Saldo, punta, verificación, pago pendiente e historial, en JSON
     * (montos en átomos: 1 ZKA = 1.000.000).
     */
    status(): string;
    /**
     * Muestra el saldo a quien la tenga, sin poder gastar.
     */
    viewKey(): string;
}

/**
 * `"full"`, `"short"` o `""` si no es una dirección de `network`.
 */
export function addressKind(text: string, network: number): string;

/**
 * La clave AES-256 que cifra la frase y el estado en el navegador: Argon2id
 * de la contraseña con `salt` (al azar, de cada bóveda), `memory_kib` KiB y
 * `iterations` pasadas, en un carril. Con 64 MiB y 3 pasadas tarda alrededor
 * de un segundo: llamarla en el Worker.
 */
export function deriveKey(password: string, salt: Uint8Array | number[], memory_kib: number, iterations: number): Uint8Array;

/**
 * Si la dirección completa `full` (la que devuelve `/address/<corta>`) es la
 * de la corta `short`: un servidor no puede cambiar el destinatario.
 */
export function matchesShort(full: string, short: string, network: number): boolean;

/**
 * 24 palabras nuevas, de 256 bits del generador del navegador.
 */
export function newPhrase(): string;

/**
 * El QR de `text` con corrección M, como el de ZKAPriv: `[ancho, módulos…]`,
 * un byte por módulo (1 = oscuro), fila por fila y sin el margen.
 */
export function qrMatrix(text: string): Uint8Array;

/**
 * La corta de una dirección completa de `network`, para mostrar a quién se
 * paga; `""` si no lo es.
 */
export function shortOf(full: string, network: number): string;

export function validPhrase(phrase: string): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_webwallet_free: (a: number, b: number) => void;
    readonly addressKind: (a: number, b: number, c: number) => [number, number];
    readonly deriveKey: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly matchesShort: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly newPhrase: () => [number, number, number, number];
    readonly qrMatrix: (a: number, b: number) => [number, number, number, number];
    readonly shortOf: (a: number, b: number, c: number) => [number, number];
    readonly validPhrase: (a: number, b: number) => number;
    readonly webwallet_addPage: (a: number, b: number, c: number) => [number, number, number];
    readonly webwallet_address: (a: number) => [number, number, number, number];
    readonly webwallet_addressRecord: (a: number) => [number, number, number, number];
    readonly webwallet_confirmCheckpoint: (a: number, b: number, c: number) => [number, number, number];
    readonly webwallet_encodeState: (a: number) => [number, number, number, number];
    readonly webwallet_inSync: (a: number) => number;
    readonly webwallet_lastTransaction: (a: number) => [number, number, number, number];
    readonly webwallet_new: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly webwallet_next: (a: number) => number;
    readonly webwallet_prove: (a: number, b: number, c: number, d: bigint, e: number, f: number) => [number, number, number, number];
    readonly webwallet_quote: (a: number, b: bigint) => [number, number];
    readonly webwallet_release: (a: number) => void;
    readonly webwallet_shortAddress: (a: number) => [number, number, number, number];
    readonly webwallet_status: (a: number) => [number, number];
    readonly webwallet_viewKey: (a: number) => [number, number, number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
