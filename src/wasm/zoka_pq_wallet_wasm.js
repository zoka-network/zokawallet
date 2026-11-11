/* @ts-self-types="./zoka_pq_wallet_wasm.d.ts" */

export class WebWallet {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WebWalletFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_webwallet_free(ptr, 0);
    }
    /**
     * Una dirección más para dar a otra persona: quienes pagan a dos
     * direcciones distintas no pueden saber que pagaron a la misma billetera.
     * Hasta ocho; cada una es un descifrado más por salida leída. Lee los
     * pagos a la nueva desde el próximo bloque, así que hay que crearla antes
     * de darla. Devuelve su número.
     * @returns {number}
     */
    addAddress() {
        const ret = wasm.webwallet_addAddress(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * Lee una página de `/scan2` (tiene que empezar en [`WebWallet::next`]);
     * devuelve la punta que tenía el servidor. Cada bloque se compara con su
     * cabecera: una página que esconde o inventa una salida se rechaza.
     * @param {Uint8Array | number[]} bytes
     * @returns {number}
     */
    addPage(bytes) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webwallet_addPage(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * La dirección completa número `index` (0 es la principal).
     * @param {number} index
     * @returns {string}
     */
    addressAt(index) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.webwallet_addressAt(this.__wbg_ptr, index);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Igual que [`WebWallet::address_record`], para la dirección número
     * `index`: así su corta también sirve.
     * @param {number} index
     * @returns {string}
     */
    addressRecordAt(index) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.webwallet_addressRecordAt(this.__wbg_ptr, index);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * El registro de la dirección corta para `POST /address`, con su
     * estampilla Argon2id (unos segundos: llamarla en un Worker).
     * @returns {string}
     */
    addressRecord() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.webwallet_addressRecord(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * La dirección completa (unos 1.760 caracteres).
     * @returns {string}
     */
    address() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.webwallet_address(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Cuántas direcciones lee: la principal y las que se sumaron.
     * @returns {number}
     */
    addresses() {
        const ret = wasm.webwallet_addresses(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Verifica la firma del checkpoint (el JSON de `/checkpoint`) y confirma
     * lo leído contra él. `true` si esa altura ya se leyó.
     * @param {string} json
     * @returns {boolean}
     */
    confirmCheckpoint(json) {
        const ptr0 = passStringToWasm0(json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webwallet_confirmCheckpoint(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] !== 0;
    }
    /**
     * El estado leído, para guardarlo (cifrado) y seguir desde ahí.
     * @returns {Uint8Array}
     */
    encodeState() {
        const ret = wasm.webwallet_encodeState(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {boolean}
     */
    inSync() {
        const ret = wasm.webwallet_inSync(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Solo lo recibido, sin saldo ni gastos. Se deriva de la misma cuenta:
     * no hay que configurar ni migrar la billetera.
     * @returns {string}
     */
    incomingViewKey() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.webwallet_incomingViewKey(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Los bytes del último pago probado, para `POST /transactions`.
     * @returns {Uint8Array}
     */
    lastTransaction() {
        const ret = wasm.webwallet_lastTransaction(this.__wbg_ptr);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * `state`: lo que devolvió [`WebWallet::encode_state`] la última vez, o
     * vacío para leer la cadena desde el bloque 1.
     * @param {string} phrase
     * @param {number} network
     * @param {Uint8Array | number[]} state
     */
    constructor(phrase, network, state) {
        const val3 = +network;
        let ptr0, len0, ptr1, len1;
        try {
            ptr0 = passStringToWasm0(phrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            len0 = WASM_VECTOR_LEN;
            ptr1 = passArray8ToWasm0(state, wasm.__wbindgen_malloc);
            len1 = WASM_VECTOR_LEN;
        } catch (e) {
            if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 1, 1); }
            if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 1, 1); }
            throw e;
        }
        const ret = wasm.webwallet_new(ptr0, len0, val3, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        WebWalletFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * La altura del próximo bloque que necesita: pedir `/scan2?from=<next>`.
     * @returns {number}
     */
    next() {
        const ret = wasm.webwallet_next(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Arma y prueba (STARK, segundos) un pago a la dirección completa `to`,
     * y reserva sus notas. Devuelve `{txid, amount_atoms, fee_atoms,
     * expiry}`; los bytes para `POST /transactions`, con
     * [`WebWallet::last_transaction`]. Si la red lo rechaza: [`WebWallet::release`].
     * @param {string} to
     * @param {bigint} amount_atoms
     * @param {string} memo
     * @returns {string}
     */
    prove(to, amount_atoms, memo) {
        let deferred5_0;
        let deferred5_1;
        try {
            const val3 = BigInt.asIntN(64, amount_atoms);
            let ptr0, len0, ptr1, len1;
            try {
                ptr0 = passStringToWasm0(to, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
                len0 = WASM_VECTOR_LEN;
                ptr1 = passStringToWasm0(memo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
                len1 = WASM_VECTOR_LEN;
            } catch (e) {
                if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 1, 1); }
                if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 1, 1); }
                throw e;
            }
            const ret = wasm.webwallet_prove(this.__wbg_ptr, ptr0, len0, val3, ptr1, len1);
            var ptr4 = ret[0];
            var len4 = ret[1];
            if (ret[3]) {
                ptr4 = 0; len4 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred5_0 = ptr4;
            deferred5_1 = len4;
            return getStringFromWasm0(ptr4, len4);
        } finally {
            wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
        }
    }
    /**
     * La comisión de un pago de `amount_atoms`, o por qué no alcanza.
     * @param {bigint} amount_atoms
     * @returns {string}
     */
    quote(amount_atoms) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.webwallet_quote(this.__wbg_ptr, amount_atoms);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * La red rechazó el pago: sus notas vuelven a estar disponibles.
     */
    release() {
        wasm.webwallet_release(this.__wbg_ptr);
    }
    /**
     * La dirección corta número `index`.
     * @param {number} index
     * @returns {string}
     */
    shortAddressAt(index) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.webwallet_shortAddressAt(this.__wbg_ptr, index);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * La dirección corta: la que se comparte y va en el QR.
     * @returns {string}
     */
    shortAddress() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.webwallet_shortAddress(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Saldo, punta, verificación, pago pendiente e historial, en JSON
     * (montos en átomos: 1 ZKA = 1.000.000).
     * @returns {string}
     */
    status() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.webwallet_status(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Muestra el saldo de la dirección principal a quien la tenga, sin poder
     * gastar. Cada dirección tiene la suya.
     * @returns {string}
     */
    viewKey() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.webwallet_viewKey(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) WebWallet.prototype[Symbol.dispose] = WebWallet.prototype.free;

/**
 * `"full"`, `"short"` o `""` si no es una dirección de `network`.
 * @param {string} text
 * @param {number} network
 * @returns {string}
 */
export function addressKind(text, network) {
    let deferred3_0;
    let deferred3_1;
    try {
        const val2 = +network;
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.addressKind(ptr0, len0, val2);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * La clave AES-256 que cifra la frase y el estado en el navegador: Argon2id
 * de la contraseña con `salt` (al azar, de cada bóveda), `memory_kib` KiB y
 * `iterations` pasadas, en un carril. Con 64 MiB y 3 pasadas tarda alrededor
 * de un segundo: llamarla en el Worker.
 * @param {string} password
 * @param {Uint8Array | number[]} salt
 * @param {number} memory_kib
 * @param {number} iterations
 * @returns {Uint8Array}
 */
export function deriveKey(password, salt, memory_kib, iterations) {
    const val3 = +memory_kib;
    const val4 = +iterations;
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArray8ToWasm0(salt, wasm.__wbindgen_malloc);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.deriveKey(ptr0, len0, ptr1, len1, val3, val4);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v5 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v5;
}

/**
 * Si la dirección completa `full` (la que devuelve `/address/<corta>`) es la
 * de la corta `short`: un servidor no puede cambiar el destinatario.
 * @param {string} full
 * @param {string} short
 * @param {number} network
 * @returns {boolean}
 */
export function matchesShort(full, short, network) {
    const val3 = +network;
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passStringToWasm0(full, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passStringToWasm0(short, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 1, 1); }
        throw e;
    }
    const ret = wasm.matchesShort(ptr0, len0, ptr1, len1, val3);
    return ret !== 0;
}

/**
 * 24 palabras nuevas, de 256 bits del generador del navegador.
 * @returns {string}
 */
export function newPhrase() {
    let deferred2_0;
    let deferred2_1;
    try {
        const ret = wasm.newPhrase();
        var ptr1 = ret[0];
        var len1 = ret[1];
        if (ret[3]) {
            ptr1 = 0; len1 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred2_0 = ptr1;
        deferred2_1 = len1;
        return getStringFromWasm0(ptr1, len1);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * El QR de `text` con corrección M, como el de ZKAPriv: `[ancho, módulos…]`,
 * un byte por módulo (1 = oscuro), fila por fila y sin el margen.
 * @param {string} text
 * @returns {Uint8Array}
 */
export function qrMatrix(text) {
    const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.qrMatrix(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * La corta de una dirección completa de `network`, para mostrar a quién se
 * paga; `""` si no lo es.
 * @param {string} full
 * @param {number} network
 * @returns {string}
 */
export function shortOf(full, network) {
    let deferred3_0;
    let deferred3_1;
    try {
        const val2 = +network;
        const ptr0 = passStringToWasm0(full, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.shortOf(ptr0, len0, val2);
        deferred3_0 = ret[0];
        deferred3_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} phrase
 * @returns {boolean}
 */
export function validPhrase(phrase) {
    const ptr0 = passStringToWasm0(phrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.validPhrase(ptr0, len0);
    return ret !== 0;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_208446807d0d1e30: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_getRandomValues_8b6f1f663e6f188d: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            table.set(0, undefined);
            table.set(1024, undefined);
            table.set(1025, null);
            table.set(1026, true);
            table.set(1027, false);
        },
    };
    return {
        __proto__: null,
        "./zoka_pq_wallet_wasm_bg.js": import0,
    };
}

const WebWalletFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_webwallet_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

let __wbg_init_promise;
async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;
    if (__wbg_init_promise === undefined) {
        __wbg_init_promise = __wbg_init_once(module_or_path);
        __wbg_init_promise.catch(() => { __wbg_init_promise = undefined; });
    }
    return __wbg_init_promise;
}

async function __wbg_init_once(module_or_path) {

    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('zoka_pq_wallet_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
