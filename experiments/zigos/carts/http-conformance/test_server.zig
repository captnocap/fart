// HTTP conformance test server.
// Listens on port 8099 with dynamic handler routes for testing.
//
// Routes:
//   /echo         — echoes back "METHOD body" (or just "METHOD" if no body)
//   /status/{N}   — returns HTTP status N with body "status: N"
//   /headers      — echoes raw request headers (method + path + body contains raw request)
//   /large        — returns ~60KB body
//   /slow         — sleeps 500ms then responds
//
// Build (from experiments/zigos/):
//   zig build-exe --dep httpserver -Mroot=carts/http-conformance/test_server.zig \
//       -Mhttpserver=framework/net/httpserver.zig -femit-bin=carts/http-conformance/test_server
//
// Run:   carts/http-conformance/test_server

const std = @import("std");
const httpserver = @import("httpserver");

// Global storage — HttpServer is ~500KB+ due to MAX_CLIENTS * MAX_REQ buffers.
// Putting it on the stack would overflow.
var server: httpserver.HttpServer = undefined;
var events: [32]httpserver.HttpEvent = undefined;

// Pre-generated large payload (~60KB of repeating text)
var large_body: [61440]u8 = undefined;
var large_body_ready: bool = false;

fn initLargeBody() void {
    if (large_body_ready) return;
    const line = "The quick brown fox jumps over the lazy dog. 0123456789ABCDEF\n";
    var offset: usize = 0;
    while (offset + line.len <= large_body.len) {
        @memcpy(large_body[offset .. offset + line.len], line);
        offset += line.len;
    }
    // Fill remainder with padding
    while (offset < large_body.len) {
        large_body[offset] = 'X';
        offset += 1;
    }
    large_body_ready = true;
}

fn handleEvent(ev: *const httpserver.HttpEvent) void {
    const method = ev.methodSlice();
    const path = ev.pathSlice();
    const body = ev.bodySlice();

    // Route: /echo — return "METHOD" or "METHOD body"
    if (std.mem.startsWith(u8, path, "/echo")) {
        var resp_buf: [16384]u8 = undefined;
        if (body.len > 0) {
            const resp = std.fmt.bufPrint(&resp_buf, "{s} {s}", .{ method, body }) catch {
                server.respond(ev.client_id, 500, "text/plain", "format error");
                return;
            };
            server.respond(ev.client_id, 200, "text/plain", resp);
        } else {
            const resp = std.fmt.bufPrint(&resp_buf, "{s}", .{method}) catch {
                server.respond(ev.client_id, 500, "text/plain", "format error");
                return;
            };
            server.respond(ev.client_id, 200, "text/plain", resp);
        }
        return;
    }

    // Route: /status/{code} — return that HTTP status code
    if (std.mem.startsWith(u8, path, "/status/")) {
        const code_str = path["/status/".len..];
        const code = std.fmt.parseInt(u16, code_str, 10) catch {
            server.respond(ev.client_id, 400, "text/plain", "invalid status code");
            return;
        };
        var status_buf: [64]u8 = undefined;
        const status_body = std.fmt.bufPrint(&status_buf, "status: {d}", .{code}) catch {
            server.respond(ev.client_id, 500, "text/plain", "format error");
            return;
        };
        server.respond(ev.client_id, code, "text/plain", status_body);
        return;
    }

    // Route: /headers — echo method, path, and body (which contains raw request info)
    if (std.mem.startsWith(u8, path, "/headers")) {
        var resp_buf: [16384]u8 = undefined;
        const resp = std.fmt.bufPrint(&resp_buf, "method={s}\npath={s}\nbody_len={d}", .{ method, path, body.len }) catch {
            server.respond(ev.client_id, 500, "text/plain", "format error");
            return;
        };
        server.respond(ev.client_id, 200, "text/plain", resp);
        return;
    }

    // Route: /large — return ~60KB body
    if (std.mem.startsWith(u8, path, "/large")) {
        initLargeBody();
        server.respond(ev.client_id, 200, "text/plain", &large_body);
        return;
    }

    // Route: /slow — sleep 500ms then respond
    if (std.mem.startsWith(u8, path, "/slow")) {
        std.Thread.sleep(500_000_000); // 500ms
        server.respond(ev.client_id, 200, "text/plain", "slow response");
        return;
    }

    // Fallback — should not reach here since httpserver handles 404 for unmatched routes,
    // but just in case the route prefix matched but the sub-path is unknown.
    server.respond(ev.client_id, 404, "text/plain", "unknown endpoint");
}

pub fn main() !void {
    const routes = [_]httpserver.Route{
        .{ .path = "/echo", .route_type = .handler },
        .{ .path = "/status", .route_type = .handler },
        .{ .path = "/headers", .route_type = .handler },
        .{ .path = "/large", .route_type = .handler },
        .{ .path = "/slow", .route_type = .handler },
    };

    std.debug.print("Starting HTTP test server on http://127.0.0.1:8099\n", .{});

    server = httpserver.HttpServer.listen(8099, &routes) catch |err| {
        std.debug.print("Failed to listen: {}\n", .{err});
        return err;
    };
    defer server.close();

    std.debug.print("HTTP test server ready.\n", .{});

    while (true) {
        const n = server.update(&events);
        for (events[0..n]) |*ev| {
            handleEvent(ev);
        }
        std.Thread.sleep(1_000_000); // 1ms poll interval
    }
}
