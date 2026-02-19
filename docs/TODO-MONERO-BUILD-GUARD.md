# TODO: Monero Build Guard — Wallet-Only Compilation Enforcement

Goal: Make it architecturally impossible to compile mining code into any Monero-related
cartridge. Not disabled. Not configurable. Not compilable.

The story: someone reviewing Cartridge should be able to read a single allowlist file and
verify in 30 seconds that no mining code is present. A forking attempt to add mining would
require a visible, reviewable change to that allowlist — and the symbol scanner catches it
as a second gate even if they try.

---

## Layer 1 — Build-time allowlist (Zig)

- [ ] Create `build_guard/monero_allowlist.txt` — explicit list of wallet2 source files
      that are permitted to compile. ~60 files. Everything not on the list doesn't exist
      in the build graph.
- [ ] Implement `MoneroWalletGuard` step in `build.zig`:
  - Iterates sources, fails build if any file isn't on the allowlist
  - Bans entire directories: `src/daemon/`, `external/randomx/`, `src/cryptonote_basic/miner.cpp`
  - Fails build with clear error message naming the offending file
- [ ] After compilation, run symbol scan step:
  - `nm` on output binary
  - grep for banned symbols: `randomx_*`, `cryptonote::miner`, `start_mining`, `stop_mining`, `get_block_template`
  - Fails build if any match found
- [ ] Generate build manifest JSON: list of compiled files + hashes, embedded in binary
      (ELF section or appended metadata block)

**Banned symbols to scan for:**
```
randomx_create_vm
randomx_run_job
rx_slow_hash
cryptonote::miner
start_mining
stop_mining
get_block_template
submit_block
```

**Banned source paths:**
```
src/daemon/
src/cryptonote_basic/miner.cpp
external/randomx/
src/crypto/rx-slow-hash.c
src/rpc/core_rpc_server.cpp
```

---

## Layer 2 — Post-build audit script (shell)

Anyone with `nm` and `strings` can verify a compiled binary — no build tooling required.

- [ ] Create `scripts/cartridge-audit.sh <binary>`
- [ ] Four phases:
  1. **Symbol scan** — `nm binary | grep -E 'randomx|start_mining|miner'` → must be empty
  2. **Library scan** — `ldd binary | grep randomx` → must be empty
  3. **String scan** — `strings binary | grep -iE 'mining|hashrate|randomx'` → flag anything suspicious
  4. **Positive check** — wallet functions must be present: `nm binary | grep -E 'wallet2|transfer|refresh'`
- [ ] Output: green/red per phase, exit 0 only if all pass
- [ ] This script becomes the public audit artifact — ship it alongside every release

---

## Layer 3 — Cartridge inspector integration

The audit script logic runs as a UI flow inside the inspector cartridge.
See TODO-CARTRIDGE-INSPECTOR.md for the full inspector spec.

- [ ] Reimplement audit phases as Lua + React UI (same logic, visual output)
- [ ] Show per-phase results with expandable details
- [ ] "Monero wallet audit: PASS" is a visible badge in the inspector

---

## Why this matters

The perception problem: Monero + Tor + embedded runtime = three keywords from every
malware report of the last five years. Cryptojacking works by embedding miners into apps
people didn't know were mining.

By making mining architecturally absent (not just disabled), the audit story becomes:
"Does this binary contain `randomx_*` symbols? No. Here's the receipt." That's binary.
Anyone can verify it. No trust required.

A forking attempt to add mining requires:
1. Adding `src/cryptonote_basic/miner.cpp` and `external/randomx/` to the allowlist (visible in git)
2. The symbol scanner catching it and failing the build (second gate)

Both layers leave evidence. Neither can be bypassed silently.
