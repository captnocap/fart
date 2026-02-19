# TODO: Capability-Based Runtime Enforcement

Goal: CartridgeOS is the execution environment. Every capability a cart can exercise is
a handle minted at launch from its manifest. A cart that declares no clipboard access
never gets the SDL clipboard functions mapped into its address space. You can't call what
doesn't exist in your world.

This is pledge/unveil from OpenBSD, applied per-cartridge, declared upfront.

---

## Core Model

```
manifest declares capabilities
        ↓
runtime mints capability handles at launch
        ↓
cart code calls framework APIs
        ↓
runtime checks: handle exists? → proceed / block + log
        ↓
audit trail: every blocked attempt logged with context
```

Capabilities are not a permission flag on a global syscall table. They are the presence or
absence of a capability handle that only the runtime can mint. A cart cannot escalate its
own privileges because privilege isn't a flag — it's a handle.

---

## Capability Categories

**Network**
- Declared as specific ports/hosts: `network: ["18081", "9050"]`
- Undeclared host → blocked + logged
- Undeclared port → blocked + logged
- Raw socket attempt (FFI bypass) → process cannot load SDL_net or equivalent unless declared

**Filesystem**
- Declared as path + access level: `filesystem: { "./saves/": "rw", "/tmp/": "r" }`
- Access outside declared paths → blocked + logged
- Declared read-only path → write attempt blocked

**Clipboard**
- Boolean: `clipboard: true/false`
- If false: SDL clipboard functions are not loaded into cart address space
- FFI bypass attempt: SDL wasn't loaded, so there's nothing to FFI into

**IPC**
- Inter-cartridge communication channel
- Declared as: `ipc: ["wallet-cart-id"]` — can only talk to declared peers
- Undeclared IPC target → blocked

**GPU**
- Boolean: whether the cart gets an OpenGL context
- An "offline game" claiming no GPU but requesting it is a red flag for cryptomining

**Process spawning**
- Declared: `spawn: ["luajit", "/bin/bash"]`
- Terminal cart declares PTY + shell spawn explicitly
- Undeclared spawn attempt → blocked

---

## Implementation Approach

**Lua side — capability gate at framework API level**

Every framework API that touches a capability checks the handle:

```lua
-- network.lua
function Network.connect(host, port)
  if not Capabilities.check("network", host, port) then
    Audit.log("blocked", "network", host, port, debug.traceback())
    return nil, "capability denied"
  end
  -- proceed with connection
end
```

The capability table is populated at launch from the manifest and is read-only thereafter.
The cart cannot write to it. Framework internals own it.

**Address space level — don't load what isn't declared**

If `clipboard: false`, SDL clipboard functions are simply not required in the Lua modules
that initialize the cart's environment. A hand-rolled FFI bypass fails because the library
symbol doesn't exist in the process's loaded libraries.

This is the strong guarantee: you can't FFI into something that was never loaded.

- [ ] Implement capability table in `lua/capabilities.lua`
- [ ] Load capability table from manifest at launch (in `sdl2_init.lua` + `init.lua`)
- [ ] Gate every framework API that touches a capability: `network.lua`, `storage.lua`,
      clipboard in `textselection.lua`, IPC if/when implemented
- [ ] Conditional library loading: only load SDL clipboard, SDL_net, etc. if declared
- [ ] Audit logger: every blocked attempt → `lua/audit.lua` with timestamp + traceback

---

## Audit Trail

Every blocked attempt is logged, not just counted.

```lua
-- lua/audit.lua
{
  timestamp = os.time(),
  capability = "network",
  attempted = { host = "8.8.8.8", port = 443 },
  declared = { "18081", "9050" },
  traceback = "...",
  verdict = "blocked"
}
```

The audit log is:
- Accessible to the inspector cartridge (read-only IPC channel to the running cart's log)
- Written to a local file if `filesystem` capability covers it
- Surfaced in the sandbox runner (see TODO-CARTRIDGE-INSPECTOR.md)

---

## The Keylogger Scenario

Someone ships a cart that looks like a game, declares minimal permissions, but tries to:
1. Read clipboard contents (undeclared)
2. Open a network connection to an exfiltration server (undeclared)
3. Broadcast clipboard contents

With runtime enforcement:
- Step 1: clipboard handle doesn't exist → blocked + logged
- Step 2: network gate checks the host → not in declared list → blocked + logged
- Step 3: never happens

The audit trail shows: "during execution, this cart attempted 2 undeclared operations."
The inspector surfaces it. The user sees the receipts.

---

## Relationship to Manifest

The manifest (see TODO-CARTRIDGE-INSPECTOR.md) is the source of truth for what gets
minted at launch. The runtime reads it once, mints handles, and discards the manifest.
From that point forward, the capability table is immutable. Even if a cart could read its
own manifest (it can't), it couldn't use that to grant itself new capabilities — the
minting window is closed.

---

## Phases

**Phase 1 — API-level gating**
- [ ] `lua/capabilities.lua` — capability table, check(), mint()
- [ ] Gate `network.lua`, `http.lua`, `storage.lua`, clipboard functions
- [ ] Audit logger: `lua/audit.lua`
- [ ] Manifest parsing at launch

**Phase 2 — Address space enforcement**
- [ ] Conditional library loading based on declared capabilities
- [ ] No clipboard functions in address space if not declared
- [ ] Document which Lua modules correspond to which capability categories

**Phase 3 — Inspector integration**
- [ ] Audit log IPC channel to inspector
- [ ] Sandbox runner uses zero-capability manifest override
- [ ] Behavioral audit report in inspector UI
