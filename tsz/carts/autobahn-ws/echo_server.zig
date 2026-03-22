// Minimal echo server for Autobahn WebSocket conformance testing.
// Listens on port 9001, echoes all messages back preserving text/binary opcode.
//
// Build: cd tsz && zig build-exe --dep wsserver -Mroot=carts/autobahn-ws/echo_server.zig -Mwsserver=framework/net/wsserver.zig -femit-bin=carts/autobahn-ws/echo_server
// Run:   carts/autobahn-ws/echo_server
// Test:  cd carts/autobahn-ws && python3 run_autobahn.py

const std = @import("std");
const wsserver = @import("wsserver");

// Global storage — WsServer (~8MB) + events (~2MB) are too large for the default stack
var server: wsserver.WsServer = .{};
var events: [128]wsserver.ServerEvent = undefined;

pub fn main() !void {
    std.debug.print("Starting echo server on ws://127.0.0.1:9001\n", .{});

    server.listenInPlace(9001) catch |err| {
        std.debug.print("Failed to listen: {}\n", .{err});
        return err;
    };
    defer server.close();

    std.debug.print("Echo server ready. Waiting for Autobahn fuzzing client...\n", .{});

    while (true) {
        const n = server.update(&events);
        for (events[0..n]) |*ev| {
            switch (ev.event_type) {
                .client_connected => {},
                .client_message => {
                    server.sendWithOpcode(ev.client_id, ev.opcode, ev.dataSlice());
                },
                .client_disconnected => {},
            }
        }
        std.Thread.sleep(1_000_000); // 1ms
    }
}
