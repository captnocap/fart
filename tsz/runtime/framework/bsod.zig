//! ReactJIT BSOD — Crash screen for the native engine
//!
//! When the watchdog or a panic fires, this opens a new SDL window
//! with the error details rendered as a styled crash report.
//! Stays open until the user presses Escape or clicks Quit.
//!
//! Rendering is done via the compositor + gpu pipeline using the
//! node tree generated from bsod.tsz (see bsod.gen.zig).

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const watchdog = @import("watchdog.zig");
const compositor = @import("compositor.zig");
const gpu = @import("gpu.zig");
const bsod_ui = @import("bsod.gen.zig");
const state = @import("state.zig");
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

/// Show the crash screen. Blocks until the user dismisses it.
/// Call this instead of just exiting — gives the user info about what happened.
pub fn show(reason: []const u8, detail: []const u8) void {
    _ = reason;
    _ = detail;

    // Also print to terminal
    std.debug.print(
        \\
        \\  ╔══════════════════════════════════════════════════╗
        \\  ║  ReactJIT Crashed                                ║
        \\  ╚══════════════════════════════════════════════════╝
        \\
        \\  RSS at crash: {d}MB
        \\
    , .{watchdog.getRssMb()});

    // Create crash window
    const window = c.SDL_CreateWindow(
        "ReactJIT Crashed",
        c.SDL_WINDOWPOS_CENTERED,
        c.SDL_WINDOWPOS_CENTERED,
        600,
        520,
        c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE,
    ) orelse {
        std.debug.print("\n=== CRASH (no window) ===\n", .{});
        return;
    };
    defer c.SDL_DestroyWindow(window);
    c.SDL_SetWindowMinimumSize(window, 400, 300);

    const renderer = c.SDL_CreateRenderer(
        window,
        -1,
        c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC,
    ) orelse {
        std.debug.print("\n=== CRASH (no renderer) ===\n", .{});
        return;
    };
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    // Init text engine for layout measurement
    var te = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/segoeui.ttf") catch
        TextEngine.init(renderer, "C:/Windows/Fonts/arial.ttf") catch {
        std.debug.print("\n=== CRASH (no font) ===\n", .{});
        return;
    };
    defer te.deinit();

    // Init GPU + compositor for this window
    gpu.init(window) catch {
        std.debug.print("\n=== CRASH (gpu init failed) ===\n", .{});
        return;
    };
    gpu.initText(te.library, te.face, te.fallback_faces, te.fallback_count);

    // Init layout measure function
    layout.setMeasureFn(struct {
        fn measure(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {
            _ = letter_spacing;
            _ = line_height;
            _ = max_lines;
            _ = no_wrap;
            // Use gpu text measurement
            _ = font_size;
            _ = max_width;
            _ = t;
            return .{};
        }
    }.measure);

    // Init the generated BSOD UI
    bsod_ui.init(0);

    var win_w: f32 = 600;
    var win_h: f32 = 520;

    // Crash screen loop
    var running = true;
    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            switch (event.type) {
                c.SDL_QUIT => running = false,
                c.SDL_KEYDOWN => {
                    if (event.key.keysym.sym == c.SDLK_ESCAPE or
                        event.key.keysym.sym == c.SDLK_q or
                        event.key.keysym.sym == c.SDLK_RETURN)
                    {
                        running = false;
                    }
                },
                c.SDL_WINDOWEVENT => {
                    if (event.window.event == c.SDL_WINDOWEVENT_SIZE_CHANGED) {
                        win_w = @floatFromInt(event.window.data1);
                        win_h = @floatFromInt(event.window.data2);
                        gpu.resize(@intCast(event.window.data1), @intCast(event.window.data2));
                    }
                },
                else => {},
            }
        }

        // Tick the UI (updates state-driven visibility)
        bsod_ui.tick();

        // Layout and render via compositor
        var root = bsod_ui.getRoot().*;
        layout.layout(&root, 0, 0, win_w, win_h);
        compositor.frame(&root, win_w, win_h, Color.rgb(15, 10, 20));
    }
}
