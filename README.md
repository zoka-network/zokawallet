# Zoka Web Wallet

The web wallet of Zoka Quantic, served at `wallet.zoka.network`. It runs on the
Zoka Quantic Testnet (v2) only.

Everything that touches the keys runs in the browser:

- The 24 recovery words make the same wallet as in ZSilent and ZKAPriv: BIP-39
  entropy is the seed, and the account is `Account::from_seed(seed, 2, 0)`.
- The wallet reads the chain from the node's public API (`api.zokascan.cc`)
  with `/scan2` pages. Every visitor downloads the same pages, so the node does
  not learn which wallet is reading. Each page is checked against its block
  header, and the result is checked against the latest checkpoint signed by
  the Zoka team (Ed25519 and ML-DSA-65).
- A payment is planned and proved (STARK) in a Web Worker. Only the proved
  payment goes to `POST /transactions`. The public node relays it to its peers
  like a payment from any other peer.
- The short address becomes resolvable when the wallet publishes its record to
  `POST /address`. The record carries an Argon2id work stamp that the browser
  finds itself. When a short address is resolved, the browser checks that the
  full address it receives matches. A node cannot hand over somebody else's
  address.

The Rust code is the same that the node and the phone run. It lives in the
node repository: `crates/zoka-pq-pool` (light wallet, proofs), `crates/zoka-light`
(checkpoints, address stamps) and `crates/zoka-pq-wallet-wasm` (this
WebAssembly). `src/wasm/SOURCE.txt` records the commit and the SHA-256 of the
copy in this repository.

## What the browser keeps

The browser keeps a vault in IndexedDB. The words, the wallet names and what
each wallet read of the chain are sealed with AES-256-GCM. The key comes from
the password through Argon2id (64 MiB, 3 passes, a random salt). Each sealed
blob names its wallet and role in the associated data, so blobs cannot be
swapped. One password opens every wallet of the browser. The wallet locks
after 10 minutes without input.

A web wallet is as safe as the browser and the code the site serves. For
larger amounts use ZSilent or ZKAPriv. `public/_headers` limits the page to its
own code and to the node's API. It allows no inline script, no other origin and
no framing. Every build lists the SHA-256 of each file it serves in
`/SHA256SUMS.txt`.

## Layout

The pages follow ZokaScan and zoka.network: a top bar with the sections
(Overview, Send, Receive, Activity, Settings), the wallet menu and the lock, and
panels below it. Creating, restoring and unlocking put the steps in a panel
next to what the wallet is. Recovery words, the view key, the password and
adding a wallet open in a window. Below 900 px the sections take a second row
of the bar and the panels stack in one column.

## Develop

```sh
npm install
npm run dev        # http://localhost:8090
npm test           # amounts, links, the core with the real WebAssembly, the pages
npm run build      # dist/ and dist/SHA256SUMS.txt
node scripts/e2e-browser.mjs [out-dir]   # headless Chrome against the testnet, 1440 px
E2E_WIDTH=390 node scripts/e2e-browser.mjs [out-dir]   # the same at a phone's width
```

To update the WebAssembly, run these commands from the node repository:

```sh
cd crates/zoka-pq-wallet-wasm
wasm-pack build --release --target web --out-dir pkg --no-pack
```

Then run `npm run update-wasm -- <node repository>` here.

## Claves de vista (rama sin publicar)

En Settings → View keys, la billetera deriva automáticamente la clave de
entrantes de la cuenta abierta. No cambia la frase, la dirección ni la bóveda.
Esa es la opción inicial; ver saldo y envíos requiere elegir Full history and
balance. Al cerrar o bloquear la billetera se desmonta el diálogo. Las claves
no se agregan al estado enviado por el Worker, a IndexedDB ni a pedidos de red.
`viewKey()` conserva la clave completa; `incomingViewKey()` agrega la limitada.

El motor actualizado marca el vuelto al crear pagos. Las claves de entrantes
no pueden distinguir el vuelto histórico sin marca de otro ingreso; la
interfaz lo explica. No se muestra ese total como saldo.
