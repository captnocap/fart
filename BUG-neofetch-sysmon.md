# BUG: Neofetch demo tabs render empty (overview/processes/ports)

## Symptom

All three tabs in `NeofetchDemo` show nothing. The tab bar renders, switching works, but content areas are blank.

## Root cause (narrowed down)

The three hooks (`useSystemInfo`, `useSystemMonitor`, `usePorts`) all use `bridge.rpc()` to call Lua-side handlers. If the RPC fails for any reason, `.catch(() => {})` silently swallows the error and `loading` stays `true` forever. Every content section is gated behind `!sys.loading` / `!ports.loading`, so nothing renders.

## What IS wired up correctly

- **Lua handlers exist**: `lua/sysmon.lua` implements `sys:info`, `sys:monitor`, `sys:ports`, `sys:kill`, `sys:log` via `sysmon.getHandlers()`
- **Handlers are registered**: `lua/init.lua:645-651` calls `pcall(require, "lua.sysmon")` and iterates `sysmon.getHandlers()` into `rpcHandlers`
- **RPC dispatch works**: `lua/init.lua:874` matches `rpc:call` commands to `rpcHandlers[method]` and pushes `rpc:<id>` events back
- **Bridge provider is present**: `storybook/src/native-main.tsx:209` wraps `<Storybook />` in `<BridgeProvider bridge={bridge}>`
- **`useBridgeOptional()` should return the bridge**, so the hooks' `if (!bridge) return` guard should not be the problem

## Suspects (untested)

1. **`pcall(require, "lua.sysmon")` fails silently** — if sysmon.lua errors on load (e.g. missing dependency, syntax, /proc not available), the handlers never register and all RPCs return `"Unknown RPC method"` — but the JS catch swallows that too

2. **RPC response never arrives** — possible timing issue where the JS hooks fire before the bridge event loop is pumping, and there's no retry

3. **sysmon.lua functions error at call time** — the `pcall(handler, payload.args)` in init.lua:876 catches errors and sends them back as `{ error: "..." }`, but the JS bridge.rpc might reject the promise, hitting the silent `.catch(() => {})`

## Files involved

| File | Role |
|------|------|
| `storybook/src/stories/NeofetchDemo.tsx` | The component — uses all three hooks |
| `packages/shared/src/useSystemMonitor.ts` | Hook — calls `bridge.rpc('sys:monitor')` |
| `packages/shared/src/useSystemInfo.ts` | Hook — calls `bridge.rpc('sys:info')` |
| `packages/shared/src/usePorts.ts` | Hook — calls `bridge.rpc('sys:ports')` |
| `packages/shared/src/context.ts` | `useBridgeOptional()` — provides bridge from context |
| `lua/sysmon.lua` | All Lua-side system monitoring functions |
| `lua/init.lua:645-651` | Registers sysmon RPC handlers |
| `lua/init.lua:871-884` | RPC dispatch loop |
| `packages/native/src/NativeBridge.ts` | Bridge `rpc()` method — sends commands, resolves promises on events |

## Debugging steps to try

1. **Add logging to the catch blocks** in all three hooks — change `.catch(() => {})` to `.catch(e => console.error('sys:monitor RPC failed:', e))` — see what the actual error is
2. **Check terminal output** for sysmon load failure — add `print("[sysmon] loaded")` at the end of sysmon.lua and `print("[sysmon] FAILED: " .. tostring(smMod))` in the else branch at init.lua:645
3. **Test the RPC manually** — in the Lua console (devtools console tab), call `sysmon.info()` directly and see if it returns data or errors
