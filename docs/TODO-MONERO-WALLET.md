# TODO: Monero Wallet Integration

Goal: Feather-style wallet capability baked into Cartridge — send, receive, hold XMR.
No full node. No mining. No browser. Keys never leave the device.

---

## Constraints (non-negotiable)

- **Wallet-only** — no mining, no daemon, no RandomX. Not disabled at runtime — never compiled.
- **No npm delivery** — monero-ts is a valid cryptographic backend but cannot be the trust story for XMR users. Keys shouldn't be near a JS runtime users didn't consent to.
- **Remote nodes only** — connect to public nodes or user-configured nodes. Route through Tor by default.
- **Capability-bounded** — the wallet process gets `network` (remote node ports) + `filesystem` (wallet file path). Nothing else.

---

## Phase 1 — monero-wallet-rpc sidecar (fastest path to working transactions)

Feather bundles `monero-wallet-rpc` and spawns it on localhost. Do the same.

**Steps:**
- [ ] Bundle `monero-wallet-rpc` binary with the wallet cartridge (static build)
- [ ] Spawn it as a child process at cart launch with a random localhost port
- [ ] Declare capabilities in manifest: `network:[remote-node:18081, tor:9050, localhost:random]`, `filesystem:[wallet-file-path]`
- [ ] Implement JSON-RPC client in Lua (already have `http.lua` + `json.lua`)
- [ ] Wire the minimal API surface needed:
  - `create_wallet` / `open_wallet` / `restore_deterministic_wallet`
  - `refresh` — scan chain for owned outputs
  - `get_balance` / `get_address`
  - `transfer` — construct + broadcast tx
  - `get_transfers` — tx history
  - `close_wallet` on cart exit
- [ ] Integrate Tor: pass `--daemon-address` through SOCKS5 proxy via existing `tor.lua`
- [ ] Curate a default remote node list (model after Feather's trusted node list)
- [ ] Let user configure custom node in settings

**Key files to reference:**
- Feather's wallet logic layer: `src/wallet/` in feather-wallet/feather repo (this is the spec for which wallet2 calls matter)
- Feather's node management: how they handle node switching and fallback
- monero-wallet-rpc JSON-RPC API docs: https://www.getmonero.org/resources/developer-guides/wallet-rpc.html

---

## Phase 2 — wallet2 direct FFI (no sidecar)

Compile wallet2 as a shared library, call it from LuaJIT FFI directly.

**Steps:**
- [ ] Study Feather source to identify minimal wallet2 API surface (avoid pulling in 15k-line monolith unnecessarily)
- [ ] Write C shim over wallet2 exposing only the functions Phase 1 identified as necessary
- [ ] Integrate into Zig build: consume Monero's CMake via `build.zig`
- [ ] Apply allowlist enforcement (see TODO-MONERO-BUILD-GUARD.md) to ensure no mining code compiles
- [ ] Replace sidecar IPC with direct FFI calls in Lua wallet module
- [ ] Measure binary size delta vs Phase 1

---

## Phase 3 — Rust WASM wallet-rpc (track, don't implement yet)

CCS-funded effort to build a modular wallet-rpc library in Rust targeting WASM as primary platform. Explicitly designed to decouple concurrency and networking from wallet code — addresses the wallet2 monolith problem architecturally.

- [ ] Watch CCS proposal status: https://ccs.getmonero.org (search "wallet-rpc")
- [ ] When it ships: evaluate WASM embeddability inside QuickJS (same path as monero-ts but Rust-compiled, different trust story)
- [ ] JSON-RPC interface should stay compatible with Phase 1 client code

---

## UX Notes

- Wallet UI is a cartridge — runs in the same React layout system as everything else
- Balance, address, tx history = React state backed by polling `monero-wallet-rpc`
- Send flow: address input → amount → fee estimate → confirm → broadcast
- No seed phrase ever touches the network — wallet file stays local, encrypted
- Tor indicator in UI — show whether current node connection is going through Tor
- Node health indicator — latency, sync height, whether the node is trustworthy (compare to known good)

---

## Why not monero-ts

monero-ts is technically solid (300+ tests, powers Haveno, covers multisig, view-only wallets, full sync). The coverage is real. The problem is cultural and architectural:

- XMR users treat JS like spyware, with good reason
- npm is the delivery mechanism — that's three layers of "nope" for the target audience
- monero-ts exists almost entirely to serve Haveno; real-world adoption outside that is thin
- The WASM blob is compiled from C++ via emscripten — less auditable than the Phase 2 direct FFI path

If QuickJS WASM hosting ever works cleanly and the Rust WASM wallet ships, revisit. Until then, sidecar or FFI.

---

## References

- Feather wallet source: https://github.com/feather-wallet/feather
- Feather build system (CMake + Docker + Guix): `contrib/guix/README.md` in their repo
- monero-wallet-rpc JSON-RPC reference: https://www.getmonero.org/resources/developer-guides/wallet-rpc.html
- Remote node lists: https://monero.fail (community-maintained, shows node health)
- CCS Rust wallet-rpc proposal: https://ccs.getmonero.org
