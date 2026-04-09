// ── Lua tree: Zig preamble ──────────────────────────────────
// Emits the Zig import block for lua-tree apps.

function emitLuaTreePreamble(prefix) {
  var zig = '';
  var fastBuild = globalThis.__fastBuild === 1;

  zig += 'const std = @import("std");\n';
  if (!fastBuild) {
    zig += 'const build_options = @import("build_options");\n';
    zig += 'const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;\n\n';
  }
  zig += 'const layout = @import("' + prefix + 'layout.zig");\n';
  zig += 'const Node = layout.Node;\n';
  zig += 'const Style = layout.Style;\n';
  zig += 'const Color = layout.Color;\n';
  zig += 'const state = @import("' + prefix + 'state.zig");\n';
  zig += 'const luajit_runtime = @import("' + prefix + 'luajit_runtime.zig");\n';
  zig += 'const qjs_runtime = @import("' + prefix + 'qjs_runtime.zig");\n';
  if (!fastBuild) {
    zig += 'const engine = if (IS_LIB) struct {} else @import("' + prefix + 'engine.zig");\n';
    zig += 'comptime { if (!IS_LIB) _ = @import("' + prefix + 'core.zig"); }\n';
  }
  zig += '\n';

  return zig;
}
