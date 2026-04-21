const std = @import("std");
const zluajit = @import("zluajit");

const MaxFlushes = 4;
const MaxCommandsPerFlush = 256;

const Opcode = enum(u32) {
    none = 0,
    create = 1,
    append = 2,
    append_to_root = 3,
    remove = 4,
    update = 5,
    create_text = 6,
    update_text = 7,
    remove_from_root = 8,
    insert_before = 9,
    insert_before_root = 10,
};

// Typed bridge shape aligned to qjs_app.zig's current JSON contract.
// Numeric routing fields become native integers/opcodes; the still-dynamic
// payloads (`props`, removal arrays, handler names) stay as pre-encoded JSON
// fragments so the existing host apply path can consume them later unchanged.
const CommandRecord = extern struct {
    opcode: u32 = @intFromEnum(Opcode.none),
    id: i32 = 0,
    parent_id: i32 = 0,
    child_id: i32 = 0,
    before_id: i32 = 0,
    type_name: [32]u8 = [_]u8{0} ** 32,
    type_len: usize = 0,
    text: [256]u8 = [_]u8{0} ** 256,
    text_len: usize = 0,
    props_json: [2048]u8 = [_]u8{0} ** 2048,
    props_len: usize = 0,
    remove_keys_json: [512]u8 = [_]u8{0} ** 512,
    remove_keys_len: usize = 0,
    remove_style_keys_json: [512]u8 = [_]u8{0} ** 512,
    remove_style_keys_len: usize = 0,
    handler_names_json: [512]u8 = [_]u8{0} ** 512,
    handler_names_len: usize = 0,
};

const FlushRecord = extern struct {
    commands: [MaxCommandsPerFlush]CommandRecord = std.mem.zeroes([MaxCommandsPerFlush]CommandRecord),
    len: usize = 0,
};

var g_flushes = std.mem.zeroes([MaxFlushes]FlushRecord);

fn field(bytes: []const u8, len: usize) []const u8 {
    return bytes[0..len];
}

fn opcodeName(opcode: u32) []const u8 {
    return switch (opcode) {
        @intFromEnum(Opcode.create) => "CREATE",
        @intFromEnum(Opcode.append) => "APPEND",
        @intFromEnum(Opcode.append_to_root) => "APPEND_TO_ROOT",
        @intFromEnum(Opcode.remove) => "REMOVE",
        @intFromEnum(Opcode.update) => "UPDATE",
        @intFromEnum(Opcode.create_text) => "CREATE_TEXT",
        @intFromEnum(Opcode.update_text) => "UPDATE_TEXT",
        @intFromEnum(Opcode.remove_from_root) => "REMOVE_FROM_ROOT",
        @intFromEnum(Opcode.insert_before) => "INSERT_BEFORE",
        @intFromEnum(Opcode.insert_before_root) => "INSERT_BEFORE_ROOT",
        else => "UNKNOWN",
    };
}

fn printFlush(index: usize, flush: FlushRecord) void {
    std.debug.print("[eqjs-host] flush[{d}] ops={d}\n", .{ index + 1, flush.len });
    for (flush.commands[0..flush.len]) |command| {
        std.debug.print("  {s}", .{opcodeName(command.opcode)});
        if (command.type_len > 0) std.debug.print("|t={s}", .{field(&command.type_name, command.type_len)});
        if (command.id != 0) std.debug.print("|id={d}", .{command.id});
        if (command.parent_id != 0) std.debug.print("|p={d}", .{command.parent_id});
        if (command.child_id != 0) std.debug.print("|c={d}", .{command.child_id});
        if (command.before_id != 0) std.debug.print("|b={d}", .{command.before_id});
        if (command.text_len > 0) std.debug.print("|x={s}", .{field(&command.text, command.text_len)});
        if (command.props_len > 0) std.debug.print("|props-json", .{});
        if (command.remove_keys_len > 0) std.debug.print("|removeKeys-json", .{});
        if (command.remove_style_keys_len > 0) std.debug.print("|removeStyleKeys-json", .{});
        if (command.handler_names_len > 0) std.debug.print("|handlerNames-json", .{});
        std.debug.print("\n", .{});
    }
}

fn appendQuotedJsonString(out: *std.ArrayList(u8), alloc: std.mem.Allocator, value: []const u8) !void {
    try out.append(alloc, '"');
    for (value) |ch| switch (ch) {
        '"' => try out.appendSlice(alloc, "\\\""),
        '\\' => try out.appendSlice(alloc, "\\\\"),
        '\n' => try out.appendSlice(alloc, "\\n"),
        '\r' => try out.appendSlice(alloc, "\\r"),
        '\t' => try out.appendSlice(alloc, "\\t"),
        else => {
            if (ch < 0x20) {
                try out.writer(alloc).print("\\u00{x:0>2}", .{ch});
            } else {
                try out.append(alloc, ch);
            }
        },
    };
    try out.append(alloc, '"');
}

fn appendJsonFieldSep(out: *std.ArrayList(u8), alloc: std.mem.Allocator, first: *bool) !void {
    if (first.*) {
        first.* = false;
    } else {
        try out.append(alloc, ',');
    }
}

fn appendJsonStringField(out: *std.ArrayList(u8), alloc: std.mem.Allocator, first: *bool, name: []const u8, value: []const u8) !void {
    try appendJsonFieldSep(out, alloc, first);
    try appendQuotedJsonString(out, alloc, name);
    try out.append(alloc, ':');
    try appendQuotedJsonString(out, alloc, value);
}

fn appendJsonIntField(out: *std.ArrayList(u8), alloc: std.mem.Allocator, first: *bool, name: []const u8, value: i32) !void {
    try appendJsonFieldSep(out, alloc, first);
    try appendQuotedJsonString(out, alloc, name);
    try out.append(alloc, ':');
    try out.writer(alloc).print("{d}", .{value});
}

fn appendJsonBoolField(out: *std.ArrayList(u8), alloc: std.mem.Allocator, first: *bool, name: []const u8, value: bool) !void {
    try appendJsonFieldSep(out, alloc, first);
    try appendQuotedJsonString(out, alloc, name);
    try out.append(alloc, ':');
    try out.appendSlice(alloc, if (value) "true" else "false");
}

fn appendJsonRawField(out: *std.ArrayList(u8), alloc: std.mem.Allocator, first: *bool, name: []const u8, raw: []const u8) !void {
    try appendJsonFieldSep(out, alloc, first);
    try appendQuotedJsonString(out, alloc, name);
    try out.append(alloc, ':');
    try out.appendSlice(alloc, raw);
}

fn compatAppendCommandJson(out: *std.ArrayList(u8), alloc: std.mem.Allocator, command: CommandRecord) !void {
    try out.append(alloc, '{');
    var first = true;

    try appendJsonStringField(out, alloc, &first, "op", opcodeName(command.opcode));

    if (command.id != 0) try appendJsonIntField(out, alloc, &first, "id", command.id);
    if (command.parent_id != 0) try appendJsonIntField(out, alloc, &first, "parentId", command.parent_id);
    if (command.child_id != 0) try appendJsonIntField(out, alloc, &first, "childId", command.child_id);
    if (command.before_id != 0) try appendJsonIntField(out, alloc, &first, "beforeId", command.before_id);
    if (command.type_len > 0) try appendJsonStringField(out, alloc, &first, "type", field(&command.type_name, command.type_len));
    if (command.text_len > 0) try appendJsonStringField(out, alloc, &first, "text", field(&command.text, command.text_len));
    if (command.props_len > 0) try appendJsonRawField(out, alloc, &first, "props", field(&command.props_json, command.props_len));
    if (command.remove_keys_len > 0) try appendJsonRawField(out, alloc, &first, "removeKeys", field(&command.remove_keys_json, command.remove_keys_len));
    if (command.remove_style_keys_len > 0) try appendJsonRawField(out, alloc, &first, "removeStyleKeys", field(&command.remove_style_keys_json, command.remove_style_keys_len));
    if (command.handler_names_len > 0) {
        const names = field(&command.handler_names_json, command.handler_names_len);
        try appendJsonRawField(out, alloc, &first, "handlerNames", names);
        try appendJsonBoolField(out, alloc, &first, "hasHandlers", !std.mem.eql(u8, names, "[]"));
    }

    try out.append(alloc, '}');
}

fn compatFlushToJson(alloc: std.mem.Allocator, flush: FlushRecord) ![]u8 {
    var out = try std.ArrayList(u8).initCapacity(alloc, 0);
    errdefer out.deinit(alloc);

    try out.append(alloc, '[');
    for (flush.commands[0..flush.len], 0..) |command, index| {
        if (index > 0) try out.append(alloc, ',');
        try compatAppendCommandJson(&out, alloc, command);
    }
    try out.append(alloc, ']');
    return out.toOwnedSlice(alloc);
}

fn compatFindCommand(parsed: std.json.Value, op: []const u8, id: ?i64) ?std.json.Value {
    if (parsed != .array) return null;
    for (parsed.array.items) |cmd| {
        if (cmd != .object) continue;
        const op_v = cmd.object.get("op") orelse continue;
        if (op_v != .string or !std.mem.eql(u8, op_v.string, op)) continue;
        if (id) |want_id| {
            const id_v = cmd.object.get("id") orelse continue;
            if (id_v != .integer or id_v.integer != want_id) continue;
        }
        return cmd;
    }
    return null;
}

fn hostLog(state: zluajit.State) c_int {
    const level = state.checkInteger(1);
    const message = state.toString(2) orelse "";
    std.debug.print("[eqjs-host][lua:{d}] {s}\n", .{ level, message });
    return 0;
}

fn getInputText(state: zluajit.State) c_int {
    _ = state.toString(1);
    state.pushString("cursor ide from zig");
    return 1;
}

fn hasCreateText(flush: FlushRecord, text: []const u8) bool {
    for (flush.commands[0..flush.len]) |command| {
        if (command.opcode == @intFromEnum(Opcode.create_text) and std.mem.eql(u8, field(&command.text, command.text_len), text)) {
            return true;
        }
    }
    return false;
}

fn hasCreateWithType(flush: FlushRecord, type_name: []const u8) bool {
    for (flush.commands[0..flush.len]) |command| {
        if (command.opcode == @intFromEnum(Opcode.create) and std.mem.eql(u8, field(&command.type_name, command.type_len), type_name)) {
            return true;
        }
    }
    return false;
}

fn hasUpdateText(flush: FlushRecord, text: []const u8) bool {
    for (flush.commands[0..flush.len]) |command| {
        if (command.opcode == @intFromEnum(Opcode.update_text) and std.mem.eql(u8, field(&command.text, command.text_len), text)) {
            return true;
        }
    }
    return false;
}

fn hasText(flush: FlushRecord, text: []const u8) bool {
    for (flush.commands[0..flush.len]) |command| {
        if ((command.opcode == @intFromEnum(Opcode.create_text) or command.opcode == @intFromEnum(Opcode.update_text)) and
            std.mem.eql(u8, field(&command.text, command.text_len), text))
        {
            return true;
        }
    }
    return false;
}

const bootstrap =
    \\local ffi = require("ffi")
    \\
    \\package.path = table.concat({
    \\  "./?.lua",
    \\  "./?/init.lua",
    \\  "./renderer/?.lua",
    \\  "./runtime/?.lua",
    \\  "./tests/eqjs/?.lua",
    \\  package.path,
    \\}, ";")
    \\
    \\ffi.cdef[[
    \\typedef struct {
    \\  uint32_t opcode;
    \\  int32_t id;
    \\  int32_t parent_id;
    \\  int32_t child_id;
    \\  int32_t before_id;
    \\  char type_name[32];
    \\  size_t type_len;
    \\  char text[256];
    \\  size_t text_len;
    \\  char props_json[2048];
    \\  size_t props_len;
    \\  char remove_keys_json[512];
    \\  size_t remove_keys_len;
    \\  char remove_style_keys_json[512];
    \\  size_t remove_style_keys_len;
    \\  char handler_names_json[512];
    \\  size_t handler_names_len;
    \\} eqjs_host_command;
    \\
    \\typedef struct {
    \\  eqjs_host_command commands[256];
    \\  size_t len;
    \\} eqjs_host_flush;
    \\]]
    \\
    \\local OPCODES = {
    \\  CREATE = 1,
    \\  APPEND = 2,
    \\  APPEND_TO_ROOT = 3,
    \\  REMOVE = 4,
    \\  UPDATE = 5,
    \\  CREATE_TEXT = 6,
    \\  UPDATE_TEXT = 7,
    \\  REMOVE_FROM_ROOT = 8,
    \\  INSERT_BEFORE = 9,
    \\  INSERT_BEFORE_ROOT = 10,
    \\}
    \\
    \\local eqjs_flushes = ffi.cast("eqjs_host_flush*", __eqjsCommandBufferPtr)
    \\local eqjs_flush_index = 0
    \\
    \\local function copy_field(dst, cap, value)
    \\  value = tostring(value or "")
    \\  ffi.fill(dst, cap, 0)
    \\  local n = math.min(#value, cap)
    \\  if n > 0 then
    \\    ffi.copy(dst, value, n)
    \\  end
    \\  return n
    \\end
    \\
    \\local function encode_string(value)
    \\  value = tostring(value or "")
    \\  value = value:gsub("\\\\", "\\\\\\\\")
    \\  value = value:gsub("\"", "\\\\\"")
    \\  value = value:gsub("\n", "\\\\n")
    \\  value = value:gsub("\r", "\\\\r")
    \\  value = value:gsub("\t", "\\\\t")
    \\  return "\"" .. value .. "\""
    \\end
    \\
    \\local function is_array(tbl)
    \\  local count = 0
    \\  local max = 0
    \\  for key, _ in pairs(tbl) do
    \\    if type(key) ~= "number" or key < 1 or key % 1 ~= 0 then
    \\      return false
    \\    end
    \\    count = count + 1
    \\    if key > max then
    \\      max = key
    \\    end
    \\  end
    \\  return count == max
    \\end
    \\
    \\local function encode_json(value)
    \\  local kind = type(value)
    \\  if kind == "nil" then
    \\    return "null"
    \\  end
    \\  if kind == "string" then
    \\    return encode_string(value)
    \\  end
    \\  if kind == "number" or kind == "boolean" then
    \\    return tostring(value)
    \\  end
    \\  if kind ~= "table" then
    \\    return "null"
    \\  end
    \\
    \\  if is_array(value) then
    \\    local parts = {}
    \\    for i = 1, #value do
    \\      parts[i] = encode_json(value[i])
    \\    end
    \\    return "[" .. table.concat(parts, ",") .. "]"
    \\  end
    \\
    \\  local keys = {}
    \\  for key, _ in pairs(value) do
    \\    if value[key] ~= nil then
    \\      keys[#keys + 1] = tostring(key)
    \\    end
    \\  end
    \\  table.sort(keys)
    \\
    \\  local parts = {}
    \\  for _, key in ipairs(keys) do
    \\    parts[#parts + 1] = encode_string(key) .. ":" .. encode_json(value[key])
    \\  end
    \\  return "{" .. table.concat(parts, ",") .. "}"
    \\end
    \\
    \\_G.__hostFlush = function(commands)
    \\  if eqjs_flush_index >= 4 then
    \\    return
    \\  end
    \\
    \\  local flush = eqjs_flushes + eqjs_flush_index
    \\  flush[0].len = 0
    \\
    \\  local count = 0
    \\  for _, op in ipairs(commands or {}) do
    \\    if count >= 256 then
    \\      break
    \\    end
    \\
    \\    local slot = flush[0].commands[count]
    \\    slot.opcode = OPCODES[op.op] or 0
    \\    slot.id = tonumber(op.id) or 0
    \\    slot.parent_id = tonumber(op.parentId) or 0
    \\    slot.child_id = tonumber(op.childId) or 0
    \\    slot.before_id = tonumber(op.beforeId) or 0
    \\    slot.type_len = copy_field(slot.type_name, 32, op.type)
    \\    slot.text_len = copy_field(slot.text, 256, op.text)
    \\    slot.props_len = copy_field(slot.props_json, 2048, op.props and encode_json(op.props) or "")
    \\    slot.remove_keys_len = copy_field(slot.remove_keys_json, 512, op.removeKeys and encode_json(op.removeKeys) or "")
    \\    slot.remove_style_keys_len = copy_field(slot.remove_style_keys_json, 512, op.removeStyleKeys and encode_json(op.removeStyleKeys) or "")
    \\    slot.handler_names_len = copy_field(slot.handler_names_json, 512, op.handlerNames and encode_json(op.handlerNames) or "")
    \\    count = count + 1
    \\  end
    \\
    \\  flush[0].len = count
    \\  eqjs_flush_index = eqjs_flush_index + 1
    \\end
    \\
    \\dofile("tests/eqjs/embedded_host_smoke.lua")
;

pub fn main() !void {
    const state = try zluajit.State.init(.{});
    defer state.deinit();
    state.openLibs();

    state.pushZFunction(hostLog);
    state.setGlobal("__hostLog");

    state.pushZFunction(getInputText);
    state.setGlobal("__getInputText");

    state.pushAnyType(@as(*anyopaque, @ptrCast(&g_flushes[0])));
    state.setGlobal("__eqjsCommandBufferPtr");

    try state.doString(bootstrap, null);

    var flush_count: usize = 0;
    for (g_flushes, 0..) |flush, index| {
        if (flush.len == 0) break;
        printFlush(index, flush);
        flush_count += 1;
    }

    if (flush_count < 3) {
        return error.ExpectedAtLeastThreeFlushes;
    }

    if (!hasCreateText(g_flushes[0], "Project Search")) {
        return error.ExpectedCursorIdeHeader;
    }
    if (!hasCreateWithType(g_flushes[0], "TextInput")) {
        return error.ExpectedCursorIdeTextInput;
    }
    if (!hasUpdateText(g_flushes[1], "query: cursor ide from zig")) {
        return error.ExpectedUpdatedQueryText;
    }
    if (!hasText(g_flushes[2], "Projects")) {
        return error.ExpectedHomeSurfaceAfterClose;
    }

    const alloc = std.heap.page_allocator;
    for (g_flushes[0..flush_count], 0..) |flush, index| {
        const compat_json = try compatFlushToJson(alloc, flush);
        defer alloc.free(compat_json);

        const parsed = try std.json.parseFromSlice(std.json.Value, alloc, compat_json, .{});
        defer parsed.deinit();

        std.debug.print("[eqjs-host] compat-json[{d}] bytes={d}\n", .{ index + 1, compat_json.len });

        if (index == 0) {
            const cmd = compatFindCommand(parsed.value, "CREATE", 12) orelse return error.ExpectedCompatCreateTextInput;
            if (cmd.object.get("type") == null or cmd.object.get("props") == null) {
                return error.ExpectedCompatCreatePayload;
            }
        } else if (index == 1) {
            const cmd = compatFindCommand(parsed.value, "UPDATE", 12) orelse return error.ExpectedCompatUpdateTextInput;
            if (cmd.object.get("props") == null or cmd.object.get("handlerNames") == null) {
                return error.ExpectedCompatUpdatePayload;
            }
        } else if (index == 2) {
            const cmd = compatFindCommand(parsed.value, "UPDATE", 1) orelse return error.ExpectedCompatRootUpdate;
            if (cmd.object.get("removeKeys") == null or cmd.object.get("props") == null) {
                return error.ExpectedCompatRootUpdatePayload;
            }
        }
    }

    std.debug.print("eqjs-host: ok ({d} flushes)\n", .{flush_count});
}
