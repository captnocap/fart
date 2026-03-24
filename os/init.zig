//! CartridgeOS init — PID 1 (Zig, static musl)
//!
//! Boots Alpine rootfs, loads virtio-gpu, launches tsz app.
//! No display server. No X11. No Wayland. Direct DRM/KMS via SDL2.

const std = @import("std");
const linux = std.os.linux;

// ── Syscall helpers ─────────────────────────────────────────────────────

fn mount(source: [*:0]const u8, target: [*:0]const u8, fstype: [*:0]const u8, flags: u32, data: ?[*:0]const u8) void {
    _ = linux.mount(source, target, fstype, flags, if (data) |d| @intFromPtr(d) else 0);
}

fn mkdir(path: [*:0]const u8) void {
    _ = linux.mkdir(path, 0o755);
}

fn write_all(fd: i32, buf: []const u8) void {
    var written: usize = 0;
    while (written < buf.len) {
        const rc = linux.write(@intCast(fd), buf[written..].ptr, buf[written..].len);
        if (@as(isize, @bitCast(rc)) <= 0) break;
        written += rc;
    }
}

fn puts(msg: []const u8) void {
    write_all(1, msg);
    write_all(1, "\n");
}

fn open_file(path: [*:0]const u8, flags: linux.O) i32 {
    const rc = linux.open(path, flags, 0);
    return if (@as(isize, @bitCast(rc)) < 0) -1 else @intCast(rc);
}

fn close_fd(fd: i32) void {
    _ = linux.close(@intCast(fd));
}

fn dup2(old: i32, new: i32) void {
    _ = linux.dup3(@intCast(old), @intCast(new), 0);
}

fn sleep_us(us: u64) void {
    const ts = linux.timespec{
        .sec = @intCast(us / 1_000_000),
        .nsec = @intCast((us % 1_000_000) * 1000),
    };
    _ = linux.nanosleep(&ts, null);
}

fn access(path: [*:0]const u8) bool {
    const rc = linux.faccessat(linux.AT.FDCWD, path, linux.F_OK, 0);
    return @as(isize, @bitCast(rc)) == 0;
}

// ── Fork + exec helpers ─────────────────────────────────────────────────

fn run_wait(argv: [*:null]const ?[*:0]const u8) void {
    const pid_rc = linux.fork();
    const pid: isize = @bitCast(pid_rc);
    if (pid == 0) {
        _ = linux.execve(argv[0].?, argv, @ptrCast(std.os.environ.ptr));
        linux.exit(1);
    }
    if (pid > 0) {
        var status: u32 = 0;
        _ = linux.wait4(@intCast(pid_rc), &status, 0, null);
    }
}

fn run_wait_env(argv: [*:null]const ?[*:0]const u8, envp: [*:null]const ?[*:0]const u8) void {
    const pid_rc = linux.fork();
    const pid: isize = @bitCast(pid_rc);
    if (pid == 0) {
        _ = linux.execve(argv[0].?, argv, envp);
        linux.exit(1);
    }
    if (pid > 0) {
        var status: u32 = 0;
        _ = linux.wait4(@intCast(pid_rc), &status, 0, null);
    }
}

// ── Main ────────────────────────────────────────────────────────────────

pub fn main() void {
    // ── Mount filesystems ───────────────────────────────────────────────
    mount("proc", "/proc", "proc", 0, null);
    mount("sysfs", "/sys", "sysfs", 0, null);
    mount("devtmpfs", "/dev", "devtmpfs", 0, null);
    mkdir("/dev/dri");

    // Suppress kernel messages on console
    const printk_fd = open_file("/proc/sys/kernel/printk", .{ .ACCMODE = .WRONLY });
    if (printk_fd >= 0) {
        write_all(printk_fd, "1\n");
        close_fd(printk_fd);
    }

    // Redirect stdio to console
    const con = open_file("/dev/console", .{ .ACCMODE = .RDWR });
    if (con >= 0) {
        dup2(con, 0);
        dup2(con, 1);
        dup2(con, 2);
        if (con > 2) close_fd(con);
    }

    // ── Busybox applets ─────────────────────────────────────────────────
    const bb_argv = [_:null]?[*:0]const u8{ "/bin/busybox", "--install", "-s", "/bin", null };
    run_wait(&bb_argv);

    // ── Banner ──────────────────────────────────────────────────────────
    puts("");
    puts("  CartridgeOS v0.3 (x86_64 — tsz + virtio-gpu)");
    puts("  DRM/KMS rendering via SDL2 + wgpu");
    puts("");

    // ── Load virtio-gpu kernel module ───────────────────────────────────
    puts("  Loading virtio-gpu driver...");
    const modprobe_argv = [_:null]?[*:0]const u8{ "/bin/modprobe", "virtio-gpu", null };
    run_wait(&modprobe_argv);
    sleep_us(1_500_000); // wait for device nodes

    if (access("/dev/dri/card0")) {
        puts("  DRM: /dev/dri/card0 ready");
    } else {
        puts("  WARNING: /dev/dri/card0 missing — trying manual node creation");
        // Try creating the device node manually
        const mknod_argv = [_:null]?[*:0]const u8{ "/bin/sh", "-c", "mknod /dev/dri/card0 c 226 0 2>/dev/null; mknod /dev/dri/renderD128 c 226 128 2>/dev/null", null };
        run_wait(&mknod_argv);
        sleep_us(500_000);
        if (access("/dev/dri/card0")) {
            puts("  DRM: /dev/dri/card0 created manually");
        } else {
            puts("  ERROR: /dev/dri/card0 still missing");
        }
    }
    if (access("/dev/dri/renderD128")) {
        puts("  DRM: /dev/dri/renderD128 ready");
    }

    // GPU PCI check
    puts("  GPU PCI devices:");
    const gpu_check_argv = [_:null]?[*:0]const u8{
        "/bin/sh", "-c",
        "for d in /sys/bus/pci/devices/*; do " ++
            "if [ -f \"$d/class\" ] && grep -q '^0x030' \"$d/class\"; then " ++
            "printf '    %s vendor=%s device=%s\\n' " ++
            "\"$(basename $d)\" \"$(cat $d/vendor)\" \"$(cat $d/device)\"; " ++
            "fi; done",
        null,
    };
    run_wait(&gpu_check_argv);

    // ── Environment for GPU rendering ───────────────────────────────────
    const gpu_envp = [_:null]?[*:0]const u8{
        "HOME=/tmp",
        "PATH=/bin:/usr/bin",
        "SDL_VIDEODRIVER=kmsdrm",
        "EGL_PLATFORM=gbm",
        "MESA_EGL_NO_X11=1",
        "MESA_LOADER_DRIVER_OVERRIDE=virtio_gpu",
        "LIBGL_DRIVERS_PATH=/usr/lib/dri:/usr/lib/xorg/modules/dri",
        "LD_LIBRARY_PATH=/app:/usr/lib:/lib",
        "XDG_RUNTIME_DIR=/tmp",
        null,
    };

    const basic_envp = [_:null]?[*:0]const u8{
        "HOME=/tmp",
        "PATH=/bin:/usr/bin",
        null,
    };

    // ── Network setup ───────────────────────────────────────────────────
    puts("  Configuring network...");
    const lo_up = [_:null]?[*:0]const u8{ "/bin/ifconfig", "lo", "up", null };
    run_wait(&lo_up);
    const eth_up = [_:null]?[*:0]const u8{ "/bin/ifconfig", "eth0", "up", null };
    run_wait(&eth_up);
    const dhcp = [_:null]?[*:0]const u8{ "/bin/udhcpc", "-i", "eth0", "-q", "-s", "/bin/true", null };
    run_wait(&dhcp);
    sleep_us(500_000);

    // ── Start HTTP bridge ───────────────────────────────────────────────
    puts("  Starting HTTP bridge on :8080...");
    const bridge_argv = [_:null]?[*:0]const u8{ "/usr/bin/bridge", null };
    const bridge_pid_rc = linux.fork();
    const bridge_pid: isize = @bitCast(bridge_pid_rc);
    if (bridge_pid == 0) {
        _ = linux.execve(bridge_argv[0].?, &bridge_argv, &basic_envp);
        linux.exit(1);
    }
    if (bridge_pid > 0) {
        puts("  HTTP bridge: running");
    }

    // ── Launch tsz app ──────────────────────────────────────────────────
    if (access("/app/tsz")) {
        puts("  Launching tsz app (DRM/KMS)...");
        puts("");

        const tsz_argv = [_:null]?[*:0]const u8{ "/app/tsz", null };
        const tsz_pid_rc = linux.fork();
        const tsz_pid: isize = @bitCast(tsz_pid_rc);
        if (tsz_pid == 0) {
            _ = linux.execve(tsz_argv[0].?, &tsz_argv, &gpu_envp);
            puts("  [init] execve tsz failed");
            linux.exit(1);
        }

        if (tsz_pid > 0) {
            var status: u32 = 0;
            _ = linux.wait4(@intCast(tsz_pid_rc), &status, 0, null);
            puts("");
            puts("  [init] tsz app exited");
        }
    } else {
        puts("  /app/tsz not found — falling back to QuickJS");
        const qjs_argv = [_:null]?[*:0]const u8{ "/usr/bin/qjs", "/app/main.js", null };
        run_wait_env(&qjs_argv, &basic_envp);
    }

    // ── Fallback shell ──────────────────────────────────────────────────
    puts("  [init] dropping to shell (Ctrl-D to reboot)");
    puts("");
    const sh_argv = [_:null]?[*:0]const u8{ "/bin/sh", null };
    _ = linux.execve(sh_argv[0].?, &sh_argv, &gpu_envp);

    // PID 1 must not exit
    while (true) {
        sleep_us(1_000_000);
    }
}
