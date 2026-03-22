//! Hand-written terminal app — PTY + vterm + Box/Text primitives.
//! No hand-painted rendering — uses the framework's existing Node primitives.

const std = @import("std");
const layout = @import("framework/layout.zig");
const engine = @import("framework/engine.zig");
const vterm_mod = @import("framework/vterm.zig");
const Node = layout.Node;
const Color = layout.Color;

const TERM_ROWS = 40;

// Row text buffers (persistent, updated each frame from vterm)
var row_bufs: [TERM_ROWS][512]u8 = [_][512]u8{[_]u8{0} ** 512} ** TERM_ROWS;
var row_lens: [TERM_ROWS]usize = [_]usize{0} ** TERM_ROWS;

// Row nodes — each is a Text node
var row_nodes: [TERM_ROWS]Node = [_]Node{.{
    .text = "",
    .font_size = 13,
    .text_color = Color.rgb(226, 232, 240),
    .no_wrap = true,
}} ** TERM_ROWS;

// Container for rows
var container_children: [TERM_ROWS]Node = undefined;
var container = Node{
    .style = .{
        .flex_direction = .column,
        .background_color = Color.rgb(15, 23, 42),
        .width = -1,
        .height = -1,
        .padding = 4,
    },
    .children = &container_children,
};

var root_children = [1]Node{.{}};
var root = Node{
    .style = .{ .width = -1, .height = -1 },
    .children = &root_children,
};

// ── Init ────────────────────────────────────────────────────────────

fn appInit() void {
    // Wire up the node tree
    for (0..TERM_ROWS) |i| {
        container_children[i] = row_nodes[i];
    }
    root_children[0] = container;

    // Spawn shell — vterm is created internally by spawnShell
    vterm_mod.spawnShell("bash", TERM_ROWS, 120);
}

// ── Tick — drain PTY, update dirty rows ─────────────────────────────

fn appTick(now_ms: u32) void {
    _ = now_ms;

    // Drain PTY → feed vterm
    const has_new_data = vterm_mod.pollPty();

    // Only update rows if there's new data (damage-driven)
    if (!has_new_data and !vterm_mod.hasDamage()) return;

    for (0..TERM_ROWS) |i| {
        const row_text = vterm_mod.getRowText(@intCast(i));
        const len = @min(row_text.len, row_bufs[i].len);
        @memcpy(row_bufs[i][0..len], row_text[0..len]);
        row_lens[i] = len;
        // Update the actual node in the tree (container_children is what container points to)
        container_children[i].text = row_bufs[i][0..len];
    }
    if (has_new_data) std.debug.print("[term] got data, row0: '{s}'\n", .{container_children[0].text orelse ""});

    vterm_mod.clearDamageState();
}

// ── Entry point ─────────────────────────────────────────────────────

pub fn main() !void {
    appInit();
    try engine.run(.{
        .title = "Terminal — PTY + vterm",
        .width = 1024,
        .height = 720,
        .root = &root,
        .init = null,
        .tick = &appTick,
    });
}
