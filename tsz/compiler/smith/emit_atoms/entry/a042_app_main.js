// ── Emit Atom 042: App main ─────────────────────────────────────
// Index: 42
// Group: entry
// Target: zig
// Status: complete
// Current owner: emit/entrypoints.js
//
// Trigger: standalone app emit path.
// Output target: pub fn main() and engine.run() scaffold.

function applies(ctx, meta) {
  void ctx; void meta;
  return true;
}

function emit(ctx, meta) {
  void ctx;
  var out = '\npub fn main() !void {\n';
  if (!meta.fastBuild) out += '    if (IS_LIB) return;\n';
  out += '    try engine.run(.{\n';
  out += '        .title = "' + meta.appName + '",\n';
  out += '        .root = &_root,\n';
  out += '        .js_logic = JS_LOGIC,\n';
  out += '        .lua_logic = LUA_LOGIC,\n';
  out += '        .init = _appInit,\n';
  out += '        .tick = _appTick,\n';
  out += '    });\n}\n';
  return out;
}

module.exports = {
  id: 42,
  name: 'app_main',
  group: 'entry',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/entrypoints.js',
  applies: applies,
  emit: emit,
};
