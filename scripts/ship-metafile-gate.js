// scripts/ship-metafile-gate.js — v8cli port of the inline gate logic that
// used to live in scripts/ship as `bun -e`. The .mjs path was removed when
// scripts/ship moved to v8cli; without this file the gate silently produces
// no output and ALL opt-in V8 bindings get force-disabled (carts that need
// them then crash at runtime when callHost hits an unregistered name).
//
// Usage: tools/v8cli scripts/ship-metafile-gate.js <metafile.json>
//
// Output: one line, space-separated 0/1 flags in this exact order:
//
//   privacy useHost useConnection fs websocket telemetry zigcall
//
// scripts/ship reads them positionally — order MUST stay stable.
//
// Mechanism: walks the esbuild metafile's outputs[].inputs map (the bytes
// that actually shipped after tree-shaking) and asks `did this hook file
// land in the bundle?`. Pure Set membership check, no string searching of
// minified code.
//
// Hook → binding map (rule: every host fn registered must have a JS-side
// caller in the bundle, otherwise binary gets destroyed by the manifest
// label check):
//
//   runtime/hooks/usePrivacy.ts        → privacy   (__priv_*)
//   runtime/hooks/useHost.ts           → useHost   (__proc_*/__httpsrv_*/__wssrv_*)
//   runtime/hooks/useConnection.ts     → useConn   (__tcp_*/__udp_*/__socks5_*/__tor_*/__ws_*)
//   runtime/hooks/fs.ts                → fs        (__fs_*/__window_*/__getenv)
//   runtime/hooks/websocket.ts         → websocket (__ws_* client)
//   runtime/hooks/math.ts              → zigcall   (__zig_call/__zig_call_list)
//
// Telemetry has no canonical hook file yet — its callers live in cart/
// (inspector and sweatshop). Gating telemetry on those exact cart paths
// is brittle but accurate; promote to a real hook file when more carts
// need it.

const argv = process.argv.slice(1);
const metafilePath = argv[0];
if (!metafilePath) {
  __writeStderr('[ship-metafile-gate] usage: ship-metafile-gate.js <metafile>\n');
  __exit(1);
}

const raw = __readFile(metafilePath);
if (raw === null) {
  __writeStderr('[ship-metafile-gate] cannot read ' + metafilePath + '\n');
  __exit(1);
}

let meta;
try {
  meta = JSON.parse(raw);
} catch (e) {
  __writeStderr('[ship-metafile-gate] bad json: ' + (e && e.message) + '\n');
  __exit(1);
}

// Walk outputs[].inputs (bytes-actually-shipped), NOT the top-level inputs
// map (everything esbuild parsed). With sideEffects: false in
// runtime/package.json, esbuild tree-shakes unused hook files out of the
// bundle entirely — but it still keeps them in top-level inputs because
// they were considered. The real signal is bytesInOutput > 0.
const shipped = new Set();
const outputs = (meta && meta.outputs) || {};
for (const outName of Object.keys(outputs)) {
  const out = outputs[outName] || {};
  const inputs = out.inputs || {};
  for (const path of Object.keys(inputs)) {
    if ((inputs[path] && inputs[path].bytesInOutput) > 0) shipped.add(path);
  }
}

const has = (path) => shipped.has(path);
const flag = (b) => (b ? '1' : '0');

// Order MUST match the read in scripts/ship.
const out = [
  flag(has('runtime/hooks/usePrivacy.ts')),                                                  // privacy
  flag(has('runtime/hooks/useHost.ts')),                                                     // useHost
  flag(has('runtime/hooks/useConnection.ts')),                                               // useConnection
  flag(has('runtime/hooks/fs.ts')),                                                          // fs
  flag(has('runtime/hooks/websocket.ts') || has('runtime/hooks/useConnection.ts')),          // websocket (ws client)
  flag(has('cart/inspector/bridge.ts') || has('cart/sweatshop/host.ts')),                    // telemetry
  flag(has('runtime/hooks/math.ts')),                                                        // zigcall
].join(' ');

__writeStdout(out + '\n');
