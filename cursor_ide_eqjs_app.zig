//! cursor_ide_eqjs_app — launch cursor-ide under the EQJS (LuaJIT) backend.
//!
//! Boots the cursor-ide cart using the pre-compiled Lua bundle in
//! /home/siah/eqjs/generated/cursor-ide-boot/ instead of the QJS path.
//! Instantiates CursorIdeApp, emits mount ops, and prints a summary so
//! the host can verify the boot surface came up.
//!
//! Build:
//!   zig build app -Dapp-name=cursor-ide-eqjs -Dapp-source=cursor_ide_eqjs_app.zig -Doptimize=ReleaseFast

const std = @import("std");
const zluajit = @import("zluajit");

fn hostLog(state: zluajit.State) c_int {
    const level = state.checkInteger(1);
    const message = state.toString(2) orelse "";
    std.debug.print("[eqjs][lua:{d}] {s}\n", .{ level, message });
    return 0;
}

fn hostStoreGet(state: zluajit.State) c_int {
    state.pushNil();
    return 1;
}

fn hostStoreSet(state: zluajit.State) c_int {
    state.pushInteger(0);
    return 1;
}

fn hostExec(state: zluajit.State) c_int {
    const cmd = state.toString(1) orelse "";
    const out = std.fmt.allocPrint(std.heap.page_allocator, "stub:{s}", .{cmd}) catch "stub:?";
    state.pushString(out);
    return 1;
}

fn hostFsReadFile(state: zluajit.State) c_int {
    const path = state.toString(1) orelse "";
    const out = std.fmt.allocPrint(std.heap.page_allocator, "-- stub:{s}", .{path}) catch "-- stub";
    state.pushString(out);
    return 1;
}

fn hostFsWriteFile(state: zluajit.State) c_int {
    state.pushInteger(0);
    return 1;
}

fn hostPtyOpen(state: zluajit.State) c_int {
    state.pushInteger(0);
    return 1;
}

fn hostNoop(state: zluajit.State) c_int {
    _ = state;
    return 0;
}

// Bootstrap Lua: load the cursor-ide runtime and bundle, boot the entry
// component, emit mount ops, and print a human-readable summary.
const BOOTSTRAP =
    \\local runtime_path = "/home/siah/eqjs/compiler/cursor_ide_boot_runtime.lua"
    \\local bundle_path  = "/home/siah/eqjs/generated/cursor-ide-boot/boot_bundle.lua"
    \\
    \\io.write("[cursor-ide-eqjs] loading runtime...\n")
    \\io.flush()
    \\local ok_rt, Runtime = pcall(dofile, runtime_path)
    \\if not ok_rt then
    \\  error("runtime load failed: " .. tostring(Runtime))
    \\end
    \\io.write("[cursor-ide-eqjs] loading bundle (may take a moment)...\n")
    \\io.flush()
    \\local ok_bnd, bundle = pcall(dofile, bundle_path)
    \\if not ok_bnd then
    \\  error("bundle load failed: " .. tostring(bundle))
    \\end
    \\
    \\io.write("[cursor-ide-eqjs] instantiating CursorIdeApp...\n")
    \\io.flush()
    \\local runtime = Runtime.new(bundle)
    \\local store = {}
    \\runtime:set_global_this({
    \\  __store_get        = __host_store_get,
    \\  __store_set        = __host_store_set,
    \\  __exec             = __host_exec,
    \\  __fs_readfile      = __host_fs_readfile,
    \\  __fs_writefile     = __host_fs_writefile,
    \\  __tel_system       = function() return { window_w = 1280, window_h = 800 } end,
    \\  __pty_open         = __host_pty_open,
    \\  __windowClose      = __host_noop,
    \\  __windowMinimize   = __host_noop,
    \\  __windowMaximize   = __host_noop,
    \\  __claude_init      = __host_noop,
    \\  __claude_send      = __host_noop,
    \\  __claude_poll      = __host_noop,
    \\  __claude_close     = __host_noop,
    \\  __kimi_init        = __host_noop,
    \\  __kimi_send        = __host_noop,
    \\  __kimi_poll        = __host_noop,
    \\  __kimi_close       = __host_noop,
    \\  __rec_start        = __host_noop,
    \\  __rec_stop         = __host_noop,
    \\  __rec_save         = __host_noop,
    \\  __rec_is_recording = function() return false end,
    \\  __rec_frame_count  = function() return 0 end,
    \\  __play_load        = __host_noop,
    \\  __play_toggle      = __host_noop,
    \\  __play_step        = __host_noop,
    \\  __play_state       = function() return { playing = false, frame = 0 } end,
    \\  __setTerminalDockHeight    = __host_noop,
    \\  __beginTerminalDockResize  = __host_noop,
    \\  __endTerminalDockResize    = __host_noop,
    \\})
    \\
    \\local instance, err = runtime:instantiate_component("CursorIdeApp", { widthBand = "desktop" })
    \\if not instance then
    \\  error("instantiate failed: " .. tostring(err))
    \\end
    \\
    \\io.write("[cursor-ide-eqjs] render_ok=" .. tostring(instance.render_ok) .. "\n")
    \\if instance.render_error then
    \\  io.write("[cursor-ide-eqjs] render_error=" .. tostring(instance.render_error) .. "\n")
    \\end
    \\
    \\local mount_ops, mount_tree = runtime:emit_mount_ops(instance.tree)
    \\local host_node_count = 0
    \\if mount_tree then
    \\  for _ in pairs(mount_tree) do host_node_count = host_node_count + 1 end
    \\end
    \\
    \\io.write(string.format("[cursor-ide-eqjs] mount_ops=%d  host_root_nodes=%d\n",
    \\  #mount_ops, host_node_count))
    \\
    \\-- Count op types
    \\local op_counts = {}
    \\for _, op in ipairs(mount_ops) do
    \\  op_counts[op.op] = (op_counts[op.op] or 0) + 1
    \\end
    \\local sorted_ops = {}
    \\for k, v in pairs(op_counts) do
    \\  sorted_ops[#sorted_ops + 1] = { k = k, v = v }
    \\end
    \\table.sort(sorted_ops, function(a, b) return a.v > b.v end)
    \\for _, entry in ipairs(sorted_ops) do
    \\  io.write(string.format("  %-20s %d\n", entry.k, entry.v))
    \\end
    \\
    \\-- Show first 12 CREATE ops with type to prove UI elements rendered
    \\io.write("\n[cursor-ide-eqjs] first 12 CREATE ops:\n")
    \\local create_shown = 0
    \\for _, op in ipairs(mount_ops) do
    \\  if op.op == "CREATE" and create_shown < 12 then
    \\    local ty = op.type_name and (" <" .. op.type_name .. ">") or ""
    \\    io.write(string.format("  id=%-4d%s\n", op.id, ty))
    \\    create_shown = create_shown + 1
    \\  end
    \\end
    \\
    \\-- Show text content that proves surfaces came up
    \\io.write("\n[cursor-ide-eqjs] visible text (first 20):\n")
    \\local text_shown = 0
    \\for _, op in ipairs(mount_ops) do
    \\  if op.op == "CREATE_TEXT" and text_shown < 20 then
    \\    io.write(string.format("  %q\n", tostring(op.text or "")))
    \\    text_shown = text_shown + 1
    \\  end
    \\end
    \\
    \\io.write("\n[cursor-ide-eqjs] BOOT COMPLETE\n")
    \\io.flush()
;

pub fn main() !void {
    std.debug.print("[cursor-ide-eqjs] initializing LuaJIT VM...\n", .{});
    const state = try zluajit.State.init(.{});
    defer state.deinit();
    state.openLibs();

    state.pushZFunction(hostLog);
    state.setGlobal("__hostLog");

    state.pushZFunction(hostStoreGet);
    state.setGlobal("__host_store_get");

    state.pushZFunction(hostStoreSet);
    state.setGlobal("__host_store_set");

    state.pushZFunction(hostExec);
    state.setGlobal("__host_exec");

    state.pushZFunction(hostFsReadFile);
    state.setGlobal("__host_fs_readfile");

    state.pushZFunction(hostFsWriteFile);
    state.setGlobal("__host_fs_writefile");

    state.pushZFunction(hostPtyOpen);
    state.setGlobal("__host_pty_open");

    state.pushZFunction(hostNoop);
    state.setGlobal("__host_noop");

    try state.doString(BOOTSTRAP, null);

    std.debug.print("[cursor-ide-eqjs] done\n", .{});
}
