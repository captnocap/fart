//! hermes_app.zig — root source for a reactjit binary driven by hermes+react-reconciler
//! instead of Smith-emitted generated_app.zig. Plugs into the real framework/engine.zig
//! via the existing AppConfig seam (root: *Node, init, tick). No framework changes.
//!
//! Build (from tsz/):
//!   zig build app -Dapp-name=hermes_d152 -Dapp-source=hermes_app.zig -Doptimize=ReleaseFast
//!
//! Run requires the hermes JS bundle to exist at:
//!   ../experiments/hermes-stack/bundle.js  (built by its esbuild step)
//! and the hermes CLI at:
//!   /home/siah/testing/ts-parse/hermes-test/hermes

const std = @import("std");
const build_options = @import("build_options");
const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;

const layout = @import("framework/layout.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const state = @import("framework/state.zig");
const engine = if (IS_LIB) struct {} else @import("framework/engine.zig");
comptime { if (!IS_LIB) _ = @import("framework/core.zig"); }

// ── Constants ──────────────────────────────────────────────────────
const HERMES_BIN = "/home/siah/testing/ts-parse/hermes-test/hermes";
const BUNDLE_JS  = "../experiments/hermes-stack/bundle.js";

// ── Globals ────────────────────────────────────────────────────────
var g_alloc: std.mem.Allocator = undefined;
var g_arena: std.heap.ArenaAllocator = undefined; // reset each tick to materialize child slices
var g_node_by_id: std.AutoHashMap(u32, *Node) = undefined;     // stable heap-allocated Nodes
var g_children_ids: std.AutoHashMap(u32, std.ArrayList(u32)) = undefined; // ordered child lists
var g_root_child_ids: std.ArrayList(u32) = .{};                // APPEND_TO_ROOT ids
var g_root: Node = .{};                                        // wrapper node passed to engine
var g_hermes_stdout: ?std.fs.File = null;
var g_hermes_child: ?std.process.Child = null;
var g_line_buf: std.ArrayList(u8) = .{};
var g_pending_bytes: std.ArrayList(u8) = .{};                  // accumulate partial reads
var g_dirty: bool = true;                                      // rebuild tree next tick
var g_read_buf: [1 << 16]u8 = undefined;
var g_saw_eof: bool = false;

// ── Color parsing ──────────────────────────────────────────────────

fn parseHex(s: []const u8) ?Color {
    if (s.len < 4 or s[0] != '#') return null;
    const body = s[1..];
    if (body.len == 3) {
        const r = std.fmt.parseInt(u8, body[0..1], 16) catch return null;
        const g = std.fmt.parseInt(u8, body[1..2], 16) catch return null;
        const b = std.fmt.parseInt(u8, body[2..3], 16) catch return null;
        return Color.rgb(r * 17, g * 17, b * 17);
    }
    if (body.len == 6) {
        const r = std.fmt.parseInt(u8, body[0..2], 16) catch return null;
        const g = std.fmt.parseInt(u8, body[2..4], 16) catch return null;
        const b = std.fmt.parseInt(u8, body[4..6], 16) catch return null;
        return Color.rgb(r, g, b);
    }
    if (body.len == 8) {
        const r = std.fmt.parseInt(u8, body[0..2], 16) catch return null;
        const g = std.fmt.parseInt(u8, body[2..4], 16) catch return null;
        const b = std.fmt.parseInt(u8, body[4..6], 16) catch return null;
        const a = std.fmt.parseInt(u8, body[6..8], 16) catch return null;
        return Color.rgba(r, g, b, a);
    }
    return null;
}

fn parseRgb(s: []const u8) ?Color {
    // rgb(r, g, b) or rgba(r, g, b, a)
    var i: usize = 0;
    while (i < s.len and s[i] != '(') i += 1;
    if (i >= s.len) return null;
    const body = s[i + 1 .. s.len - 1];
    var it = std.mem.splitScalar(u8, body, ',');
    var parts: [4]u8 = .{ 0, 0, 0, 255 };
    var idx: usize = 0;
    while (it.next()) |p| : (idx += 1) {
        if (idx >= 4) break;
        const trimmed = std.mem.trim(u8, p, " \t");
        const v = std.fmt.parseFloat(f32, trimmed) catch continue;
        const clamped = @max(@min(v, 255.0), 0.0);
        parts[idx] = @intFromFloat(clamped);
    }
    return Color.rgba(parts[0], parts[1], parts[2], parts[3]);
}

fn parseColor(s: []const u8) ?Color {
    if (s.len == 0) return null;
    if (s[0] == '#') return parseHex(s);
    if (std.mem.startsWith(u8, s, "rgb")) return parseRgb(s);
    const eq = std.mem.eql;
    if (eq(u8, s, "black"))   return Color.rgb(0, 0, 0);
    if (eq(u8, s, "white"))   return Color.rgb(255, 255, 255);
    if (eq(u8, s, "red"))     return Color.rgb(220, 50, 50);
    if (eq(u8, s, "blue"))    return Color.rgb(70, 130, 230);
    if (eq(u8, s, "green"))   return Color.rgb(60, 190, 100);
    if (eq(u8, s, "yellow"))  return Color.rgb(240, 210, 60);
    if (eq(u8, s, "cyan"))    return Color.rgb(70, 210, 230);
    if (eq(u8, s, "magenta")) return Color.rgb(220, 80, 200);
    if (eq(u8, s, "transparent")) return Color.rgba(0, 0, 0, 0);
    return null;
}

fn jsonFloat(v: std.json.Value) ?f32 {
    return switch (v) {
        .integer => |i| @floatFromInt(i),
        .float   => |f| @floatCast(f),
        else => null,
    };
}

fn jsonInt(v: std.json.Value) ?i64 {
    return switch (v) {
        .integer => |i| i,
        .float   => |f| @intFromFloat(f),
        else => null,
    };
}

// ── Style mapping ─────────────────────────────────────────────────

fn applyStyleEntry(node: *Node, key: []const u8, val: std.json.Value) void {
    const eq = std.mem.eql;
    // Dimensions
    if (eq(u8, key, "width")) {
        if (jsonFloat(val)) |f| node.style.width = f;
    } else if (eq(u8, key, "height")) {
        if (jsonFloat(val)) |f| node.style.height = f;
    } else if (eq(u8, key, "minWidth")) {
        if (jsonFloat(val)) |f| node.style.min_width = f;
    } else if (eq(u8, key, "maxWidth")) {
        if (jsonFloat(val)) |f| node.style.max_width = f;
    } else if (eq(u8, key, "minHeight")) {
        if (jsonFloat(val)) |f| node.style.min_height = f;
    } else if (eq(u8, key, "maxHeight")) {
        if (jsonFloat(val)) |f| node.style.max_height = f;
    // Flex
    } else if (eq(u8, key, "flexDirection")) {
        if (val == .string) {
            const s = val.string;
            if (eq(u8, s, "row")) node.style.flex_direction = .row
            else if (eq(u8, s, "row-reverse")) node.style.flex_direction = .row_reverse
            else if (eq(u8, s, "column-reverse")) node.style.flex_direction = .column_reverse
            else node.style.flex_direction = .column;
        }
    } else if (eq(u8, key, "flexGrow")) {
        if (jsonFloat(val)) |f| node.style.flex_grow = f;
    } else if (eq(u8, key, "flexShrink")) {
        if (jsonFloat(val)) |f| node.style.flex_shrink = f;
    } else if (eq(u8, key, "flexBasis")) {
        if (jsonFloat(val)) |f| node.style.flex_basis = f;
    } else if (eq(u8, key, "flexWrap")) {
        if (val == .string) {
            if (eq(u8, val.string, "wrap")) node.style.flex_wrap = .wrap
            else node.style.flex_wrap = .no_wrap;
        }
    } else if (eq(u8, key, "gap")) {
        if (jsonFloat(val)) |f| node.style.gap = f;
    } else if (eq(u8, key, "rowGap")) {
        if (jsonFloat(val)) |f| node.style.row_gap = f;
    } else if (eq(u8, key, "columnGap")) {
        if (jsonFloat(val)) |f| node.style.column_gap = f;
    } else if (eq(u8, key, "justifyContent")) {
        if (val == .string) {
            const s = val.string;
            if (eq(u8, s, "center")) node.style.justify_content = .center
            else if (eq(u8, s, "end") or eq(u8, s, "flex-end")) node.style.justify_content = .end
            else if (eq(u8, s, "space-between") or eq(u8, s, "spaceBetween")) node.style.justify_content = .space_between
            else if (eq(u8, s, "space-around")) node.style.justify_content = .space_around
            else if (eq(u8, s, "space-evenly")) node.style.justify_content = .space_evenly
            else node.style.justify_content = .start;
        }
    } else if (eq(u8, key, "alignItems")) {
        if (val == .string) {
            const s = val.string;
            if (eq(u8, s, "center")) node.style.align_items = .center
            else if (eq(u8, s, "start") or eq(u8, s, "flex-start")) node.style.align_items = .start
            else if (eq(u8, s, "end") or eq(u8, s, "flex-end")) node.style.align_items = .end
            else node.style.align_items = .stretch;
        }
    // Padding/margin
    } else if (eq(u8, key, "padding")) {
        if (jsonFloat(val)) |f| node.style.padding = f;
    } else if (eq(u8, key, "paddingLeft")) {
        if (jsonFloat(val)) |f| node.style.padding_left = f;
    } else if (eq(u8, key, "paddingRight")) {
        if (jsonFloat(val)) |f| node.style.padding_right = f;
    } else if (eq(u8, key, "paddingTop")) {
        if (jsonFloat(val)) |f| node.style.padding_top = f;
    } else if (eq(u8, key, "paddingBottom")) {
        if (jsonFloat(val)) |f| node.style.padding_bottom = f;
    } else if (eq(u8, key, "margin")) {
        if (jsonFloat(val)) |f| node.style.margin = f;
    } else if (eq(u8, key, "marginLeft")) {
        if (jsonFloat(val)) |f| node.style.margin_left = f;
    } else if (eq(u8, key, "marginRight")) {
        if (jsonFloat(val)) |f| node.style.margin_right = f;
    } else if (eq(u8, key, "marginTop")) {
        if (jsonFloat(val)) |f| node.style.margin_top = f;
    } else if (eq(u8, key, "marginBottom")) {
        if (jsonFloat(val)) |f| node.style.margin_bottom = f;
    // Border
    } else if (eq(u8, key, "borderWidth")) {
        if (jsonFloat(val)) |f| node.style.border_width = f;
    } else if (eq(u8, key, "borderLeftWidth")) {
        if (jsonFloat(val)) |f| node.style.border_left_width = f;
    } else if (eq(u8, key, "borderColor")) {
        if (val == .string) node.style.border_color = parseColor(val.string);
    } else if (eq(u8, key, "borderRadius")) {
        if (jsonFloat(val)) |f| node.style.border_radius = f;
    // Visual
    } else if (eq(u8, key, "backgroundColor")) {
        if (val == .string) node.style.background_color = parseColor(val.string);
    } else if (eq(u8, key, "opacity")) {
        if (jsonFloat(val)) |f| node.style.opacity = f;
    }
}

fn applyStyle(node: *Node, style_v: std.json.Value) void {
    if (style_v != .object) return;
    var it = style_v.object.iterator();
    while (it.next()) |e| {
        applyStyleEntry(node, e.key_ptr.*, e.value_ptr.*);
    }
}

// ── Top-level props (fontSize/color on Text) ─────────────────────

fn applyProps(node: *Node, props: std.json.Value) void {
    if (props != .object) return;
    var it = props.object.iterator();
    while (it.next()) |e| {
        const k = e.key_ptr.*;
        const v = e.value_ptr.*;
        if (std.mem.eql(u8, k, "style")) {
            applyStyle(node, v);
        } else if (std.mem.eql(u8, k, "fontSize")) {
            if (jsonInt(v)) |i| node.font_size = @intCast(@max(i, 1));
        } else if (std.mem.eql(u8, k, "color")) {
            if (v == .string) node.text_color = parseColor(v.string);
        }
    }
}

// ── Command application ─────────────────────────────────────────

fn ensureNode(id: u32) !*Node {
    if (g_node_by_id.get(id)) |n| return n;
    const n = try g_alloc.create(Node);
    n.* = .{};
    try g_node_by_id.put(id, n);
    try g_children_ids.put(id, .{});
    return n;
}

fn applyCommand(cmd: std.json.Value) !void {
    if (cmd != .object) return;
    const op_v = cmd.object.get("op") orelse return;
    const op = op_v.string;

    if (std.mem.eql(u8, op, "CREATE")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        const n = try ensureNode(id);
        if (cmd.object.get("props")) |props| applyProps(n, props);
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "CREATE_TEXT")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        const n = try ensureNode(id);
        if (cmd.object.get("text")) |t| if (t == .string) {
            n.text = try g_alloc.dupe(u8, t.string);
        };
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "APPEND")) {
        const pid: u32 = @intCast(cmd.object.get("parentId").?.integer);
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        _ = try ensureNode(pid);
        _ = try ensureNode(cid);
        if (g_children_ids.getPtr(pid)) |list| try list.append(g_alloc, cid);
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "APPEND_TO_ROOT")) {
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        _ = try ensureNode(cid);
        try g_root_child_ids.append(g_alloc, cid);
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "INSERT_BEFORE")) {
        const pid: u32 = @intCast(cmd.object.get("parentId").?.integer);
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        const bid: u32 = @intCast(cmd.object.get("beforeId").?.integer);
        _ = try ensureNode(cid);
        if (g_children_ids.getPtr(pid)) |list| {
            var idx: usize = list.items.len;
            for (list.items, 0..) |x, i| if (x == bid) { idx = i; break; };
            try list.insert(g_alloc, idx, cid);
        }
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "REMOVE")) {
        const pid: u32 = @intCast(cmd.object.get("parentId").?.integer);
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        if (g_children_ids.getPtr(pid)) |list| {
            for (list.items, 0..) |x, i| if (x == cid) { _ = list.orderedRemove(i); break; };
        }
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "REMOVE_FROM_ROOT")) {
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        for (g_root_child_ids.items, 0..) |x, i| if (x == cid) { _ = g_root_child_ids.orderedRemove(i); break; };
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "UPDATE")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        if (g_node_by_id.get(id)) |n| {
            if (cmd.object.get("props")) |props| applyProps(n, props);
            g_dirty = true;
        }
    } else if (std.mem.eql(u8, op, "UPDATE_TEXT")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        if (g_node_by_id.get(id)) |n| {
            if (cmd.object.get("text")) |t| if (t == .string) {
                n.text = try g_alloc.dupe(u8, t.string);
            };
            g_dirty = true;
        }
    }
}

fn applyCommandBatch(bytes: []const u8) !void {
    const parsed = std.json.parseFromSlice(std.json.Value, g_alloc, bytes, .{}) catch |err| {
        std.debug.print("[hermes] JSON parse error: {s}\n", .{@errorName(err)});
        return;
    };
    defer parsed.deinit();
    if (parsed.value != .array) return;
    for (parsed.value.array.items) |cmd| applyCommand(cmd) catch |err| {
        std.debug.print("[hermes] apply error: {s}\n", .{@errorName(err)});
    };
}

// ── Hermes subprocess + line reader ─────────────────────────────

fn spawnHermes() !void {
    const child_alloc = g_alloc;
    g_hermes_child = std.process.Child.init(&.{ HERMES_BIN, BUNDLE_JS }, child_alloc);
    g_hermes_child.?.stdout_behavior = .Pipe;
    g_hermes_child.?.stderr_behavior = .Inherit;
    try g_hermes_child.?.spawn();
    g_hermes_stdout = g_hermes_child.?.stdout;
}

fn drainHermesNonBlocking() !void {
    if (g_hermes_stdout == null or g_saw_eof) return;
    // Make stdout non-blocking via fcntl — we poll each tick.
    const fd = g_hermes_stdout.?.handle;
    const std_os = std.posix;
    const flags = std_os.fcntl(fd, std_os.F.GETFL, 0) catch return;
    const O_NONBLOCK: u32 = 0o4000;
    _ = std_os.fcntl(fd, std_os.F.SETFL, flags | O_NONBLOCK) catch {};
    while (true) {
        const n = std_os.read(fd, &g_read_buf) catch |err| switch (err) {
            error.WouldBlock => return,
            else => {
                g_saw_eof = true;
                return;
            },
        };
        if (n == 0) { g_saw_eof = true; return; }
        for (g_read_buf[0..n]) |ch| {
            if (ch == '\n') {
                if (std.mem.startsWith(u8, g_line_buf.items, "CMD ")) {
                    applyCommandBatch(g_line_buf.items[4..]) catch {};
                }
                g_line_buf.clearRetainingCapacity();
            } else {
                g_line_buf.append(g_alloc, ch) catch {};
            }
        }
    }
}

fn drainHermesUntilFirstFlush() !void {
    if (g_hermes_stdout == null) return;
    const fd = g_hermes_stdout.?.handle;
    const std_os = std.posix;
    var saw_flush = false;
    while (!saw_flush) {
        const n = std_os.read(fd, &g_read_buf) catch break;
        if (n == 0) break;
        for (g_read_buf[0..n]) |ch| {
            if (ch == '\n') {
                if (std.mem.startsWith(u8, g_line_buf.items, "CMD ")) {
                    applyCommandBatch(g_line_buf.items[4..]) catch {};
                    saw_flush = true;
                } else if (std.mem.startsWith(u8, g_line_buf.items, "DONE")) {
                    g_saw_eof = true;
                    saw_flush = true;
                }
                g_line_buf.clearRetainingCapacity();
            } else {
                g_line_buf.append(g_alloc, ch) catch {};
            }
        }
    }
}

// ── Tree materialization ─────────────────────────────────────────
// Framework Node.children is []Node (inline). Each tick we rebuild children
// slices from the id-graph into an arena.

fn materializeChildren(arena: std.mem.Allocator, parent_id: u32) []Node {
    const ids = g_children_ids.get(parent_id) orelse return &.{};
    if (ids.items.len == 0) return &.{};
    const out = arena.alloc(Node, ids.items.len) catch return &.{};
    for (ids.items, 0..) |cid, i| {
        const src = g_node_by_id.get(cid) orelse {
            out[i] = .{};
            continue;
        };
        out[i] = src.*;
        out[i].children = materializeChildren(arena, cid);
    }
    return out;
}

fn rebuildTree() void {
    _ = g_arena.reset(.retain_capacity);
    const arena = g_arena.allocator();
    if (g_root_child_ids.items.len == 0) {
        g_root.children = &.{};
        return;
    }
    const out = arena.alloc(Node, g_root_child_ids.items.len) catch return;
    for (g_root_child_ids.items, 0..) |cid, i| {
        const src = g_node_by_id.get(cid) orelse {
            out[i] = .{};
            continue;
        };
        out[i] = src.*;
        out[i].children = materializeChildren(arena, cid);
    }
    g_root.children = out;
    // Root itself: fill the window
    g_root.style.width = null;
    g_root.style.height = null;
}

// ── init / tick ─────────────────────────────────────────────────

fn hermesInit() void {
    spawnHermes() catch |err| {
        std.debug.print("[hermes] spawn failed: {s}\n", .{@errorName(err)});
        return;
    };
    drainHermesUntilFirstFlush() catch {};
    rebuildTree();
    layout.markLayoutDirty();
    std.debug.print("[hermes] initial tree: {d} root children\n", .{g_root_child_ids.items.len});
}

fn hermesTick(now: u32) void {
    _ = now;
    drainHermesNonBlocking() catch {};
    if (g_dirty) {
        rebuildTree();
        layout.markLayoutDirty();
        g_dirty = false;
    }
}

// ── main ────────────────────────────────────────────────────────

pub fn main() !void {
    if (IS_LIB) return;

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    g_alloc = gpa.allocator();
    g_arena = std.heap.ArenaAllocator.init(g_alloc);
    g_node_by_id = std.AutoHashMap(u32, *Node).init(g_alloc);
    g_children_ids = std.AutoHashMap(u32, std.ArrayList(u32)).init(g_alloc);

    // Root: a transparent container filling the window. Engine takes &g_root.
    g_root = .{};

    try engine.run(.{
        .title = "hermes-d152",
        .root = &g_root,
        .js_logic = "",
        .lua_logic = "",
        .init = hermesInit,
        .tick = hermesTick,
    });
}
