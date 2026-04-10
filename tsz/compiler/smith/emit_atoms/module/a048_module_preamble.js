// ── Module Emit Atom 048: Preamble ──────────────────────────────

function _a048_module_applies(ctx, meta) {
  void ctx;
  return meta && meta.target === 'zig';
}

function _a048_module_emit(ctx, meta) {
  void ctx;
  void meta;
  return (
    'const std = @import("std");\n\n' +
    'inline fn ptr(slice: anytype) usize {\n' +
    '    return @intFromPtr(slice.ptr);\n' +
    '}\n\n' +
    'inline fn bits(val: f32) u32 {\n' +
    '    return @as(u32, @bitCast(val));\n' +
    '}\n\n' +
    'inline fn max(a: anytype, b: @TypeOf(a)) @TypeOf(a) {\n' +
    '    return @max(a, b);\n' +
    '}\n\n' +
    'inline fn min(a: anytype, b: @TypeOf(a)) @TypeOf(a) {\n' +
    '    return @min(a, b);\n' +
    '}\n\n' +
    'inline fn is_infinite(val: anytype) bool {\n' +
    '    return std.math.isInf(val);\n' +
    '}\n\n' +
    'inline fn reverse(slice: anytype) void {\n' +
    '    const Elem = std.meta.Child(@TypeOf(slice));\n' +
    '    std.mem.reverse(Elem, slice);\n' +
    '}\n\n'
  );
}

_moduleEmitAtoms[48] = {
  id: 48,
  name: 'module_preamble',
  group: 'module',
  target: 'module_zig',
  status: 'complete',
  currentOwner: 'mod/index.js',
  applies: _a048_module_applies,
  emit: _a048_module_emit,
};
