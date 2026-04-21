const std = @import("std");
const testing = std.testing;
const layout = @import("layout.zig");
const luajit_runtime = @import("luajit_runtime.zig");

fn countTreeNodes(node: layout.Node) usize {
    var total: usize = 0;
    for (node.children) |child| {
        total += 1;
        total += countTreeNodes(child);
    }
    return total;
}

test "luajit runtime JSRT counter mutates the Zig node pool" {
    luajit_runtime.initVM();
    defer luajit_runtime.deinit();

    const script: []const u8 = @embedFile("luajit_runtime_test.lua");
    luajit_runtime.evalScript(script);

    const root = luajit_runtime.jsrtRoot();
    try testing.expectEqual(@as(usize, 1), root.children.len);
    try testing.expectEqual(@as(usize, 3), countTreeNodes(root.*));

    const pressable = root.children[0];
    try testing.expectEqualStrings("Pressable", pressable.debug_name orelse "");
    try testing.expectEqual(@as(usize, 1), pressable.children.len);

    const text_host = pressable.children[0];
    try testing.expectEqualStrings("Text", text_host.debug_name orelse "");
    try testing.expectEqual(@as(usize, 1), text_host.children.len);

    const text_leaf_before = text_host.children[0];
    try testing.expectEqualStrings("0", text_leaf_before.text orelse "");

    luajit_runtime.callGlobal("__zig_dispatch");

    const updated_root = luajit_runtime.jsrtRoot();
    try testing.expectEqual(@as(usize, 1), updated_root.children.len);
    try testing.expectEqual(@as(usize, 3), countTreeNodes(updated_root.*));

    const updated_pressable = updated_root.children[0];
    const updated_text_host = updated_pressable.children[0];
    const updated_text_leaf = updated_text_host.children[0];
    try testing.expectEqualStrings("1", updated_text_leaf.text orelse "");
}
