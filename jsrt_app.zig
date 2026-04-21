//! jsrt_app.zig — React running through the LuaJIT-hosted JSRT evaluator.
//!
//! Build:
//!   zig build app -Dapp-name=hello -Dapp-source=jsrt_app.zig -Doptimize=ReleaseFast

const std = @import("std");
const build_options = @import("build_options");
const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;

const layout = @import("framework/layout.zig");
const Node = layout.Node;
const engine = if (IS_LIB) struct {} else @import("framework/engine.zig");
const luajit_runtime = @import("framework/luajit_runtime.zig");
const lua_guard = @import("framework/lua_guard.zig");
const fs_mod = @import("framework/fs.zig");
const localstore = @import("framework/localstore.zig");
comptime { if (!IS_LIB) _ = @import("framework/core.zig"); }

const lua = lua_guard.lua;

const WINDOW_TITLE = std.fmt.comptimePrint("{s}", .{
    if (@hasDecl(build_options, "app_name") and build_options.app_name.len > 0)
        build_options.app_name
    else
        "reactjit",
});

const AST_FILE_NAME = std.fmt.comptimePrint("bundle-{s}.ast.lua", .{
    if (@hasDecl(build_options, "app_name") and build_options.app_name.len > 0)
        build_options.app_name
    else
        "app",
});
const AST_BYTES = @embedFile(AST_FILE_NAME);
const AST_LABEL: [:0]const u8 = "<embedded-jsrt-ast>";

const LUAJIT_MODULES = [_]struct { name: [:0]const u8, source: []const u8 }{
    .{ .name = "renderer.hostConfig", .source = @embedFile("renderer/hostConfig.lua") },
    .{ .name = "framework.lua.jsrt.values", .source = @embedFile("framework/lua/jsrt/values.lua") },
    .{ .name = "framework.lua.jsrt.scope", .source = @embedFile("framework/lua/jsrt/scope.lua") },
    .{ .name = "framework.lua.jsrt.evaluator", .source = @embedFile("framework/lua/jsrt/evaluator.lua") },
    .{ .name = "framework.lua.jsrt.builtins", .source = @embedFile("framework/lua/jsrt/builtins.lua") },
    .{ .name = "framework.lua.jsrt.host", .source = @embedFile("framework/lua/jsrt/host.lua") },
    .{ .name = "framework.lua.jsrt.init", .source = @embedFile("framework/lua/jsrt/init.lua") },
};

const JSRT_BOOTSTRAP =
    \\local JSRT = require("framework.lua.jsrt.init")
    \\local Values = require("framework.lua.jsrt.values")
    \\
    \\local globals = {
    \\  __getInputTextForNode = Values.newNativeFunction(function(args)
    \\    local id = tonumber(args[1]) or 0
    \\    return getInputText(id)
    \\  end),
    \\  __hostLog = Values.newNativeFunction(function(args)
    \\    return __hostLog(tonumber(args[1]) or 0, tostring(args[2] or ""))
    \\  end),
    \\  __hostGetEvents = Values.newNativeFunction(function(_args)
    \\    return Values.newArray()
    \\  end),
    \\}
    \\
    \\local function applyCommand(cmd)
    \\  local op = cmd.op
    \\  if op == "CREATE_TEXT" then
    \\    __hostCreateText(cmd.id, cmd.text or "")
    \\  elseif op == "CREATE" then
    \\    __hostCreate(cmd.id, cmd.type or "", cmd.props or {})
    \\  elseif op == "APPEND" then
    \\    __hostAppend(cmd.parentId, cmd.childId)
    \\  elseif op == "APPEND_TO_ROOT" then
    \\    __hostAppendToRoot(cmd.childId)
    \\  elseif op == "UPDATE_TEXT" then
    \\    __hostUpdateText(cmd.id, cmd.text or "")
    \\  elseif op == "UPDATE" then
    \\    __hostUpdate(cmd.id, cmd.props or {})
    \\  elseif op == "REMOVE" then
    \\    __hostRemove(cmd.parentId, cmd.childId)
    \\  elseif op == "REMOVE_FROM_ROOT" then
    \\    __hostRemoveFromRoot(cmd.childId)
    \\  elseif op == "INSERT_BEFORE" then
    \\    __hostInsertBefore(cmd.parentId, cmd.childId, cmd.beforeId)
    \\  elseif op == "INSERT_BEFORE_ROOT" then
    \\    __hostInsertBeforeRoot(cmd.childId, cmd.beforeId)
    \\  end
    \\end
    \\
    \\local function onFlush(commands)
    \\  for i = 1, #commands do
    \\    applyCommand(commands[i])
    \\  end
    \\  __hostFlush()
    \\end
    \\
    \\JSRT.run(__embedded_ast, { host = { dispatchSlot = { fn = nil }, onFlush = onFlush }, globals = globals })
;

fn setLoadedModule(L: *lua.lua_State, name: [:0]const u8) void {
    _ = lua.lua_getglobal(L, "package");
    if (!lua.lua_istable(L, -1)) {
        lua.lua_pop(L, 1);
        return;
    }
    lua.lua_getfield(L, -1, "loaded");
    if (!lua.lua_istable(L, -1)) {
        lua.lua_pop(L, 2);
        return;
    }
    lua.lua_pushvalue(L, -3);
    lua.lua_setfield(L, -2, name);
    lua.lua_pop(L, 3);
}

fn preloadModule(name: [:0]const u8, source: []const u8) bool {
    const raw_L = luajit_runtime.g_lua orelse return false;
    const L: *lua.lua_State = @ptrCast(raw_L);
    const guard = lua_guard.StackGuard.init(L);
    defer guard.deinit();

    if (lua.luaL_loadbuffer(L, source.ptr, source.len, name) != 0) {
        lua_guard.logLuaError(L, name);
        lua.lua_pop(L, 1);
        return false;
    }
    if (lua.lua_pcall(L, 0, 1, 0) != 0) {
        lua_guard.logLuaError(L, name);
        lua.lua_pop(L, 1);
        return false;
    }
    setLoadedModule(L, name);
    return true;
}

fn loadEmbeddedAst() bool {
    const raw_L = luajit_runtime.g_lua orelse return false;
    const L: *lua.lua_State = @ptrCast(raw_L);
    const guard = lua_guard.StackGuard.init(L);
    defer guard.deinit();

    if (lua.luaL_loadbuffer(L, AST_BYTES.ptr, AST_BYTES.len, AST_LABEL) != 0) {
        lua_guard.logLuaError(L, "embedded-jsrt-ast");
        lua.lua_pop(L, 1);
        return false;
    }
    if (lua.lua_pcall(L, 0, 1, 0) != 0) {
        lua_guard.logLuaError(L, "embedded-jsrt-ast");
        lua.lua_pop(L, 1);
        return false;
    }
    lua.lua_setglobal(L, "__embedded_ast");
    return true;
}

fn appInit() void {
    fs_mod.init("reactjit") catch |e| std.log.warn("fs init failed: {}", .{e});
    localstore.init() catch |e| std.log.warn("localstore init failed: {}", .{e});

    for (LUAJIT_MODULES) |module| {
        if (!preloadModule(module.name, module.source)) {
            @panic("jsrt_app: failed to preload Lua module");
        }
    }

    if (!loadEmbeddedAst()) {
        @panic("jsrt_app: failed to load embedded AST");
    }
}

fn dumpAst() !void {
    const stdout = std.fs.File.stdout();
    try stdout.writeAll(AST_BYTES);
}

pub fn main() !void {
    if (IS_LIB) return;

    const args = try std.process.argsAlloc(std.heap.page_allocator);
    defer std.process.argsFree(std.heap.page_allocator, args);
    for (args[1..]) |arg| {
        if (std.mem.eql(u8, arg, "--dump-ast")) {
            try dumpAst();
            return;
        }
    }

    try engine.run(.{
        .title = WINDOW_TITLE,
        .root = luajit_runtime.jsrtRoot(),
        .js_logic = "",
        .lua_logic = JSRT_BOOTSTRAP,
        .init = appInit,
        .tick = null,
        .borderless = false,
        .set_canvas_node_position = null,
    });
}
