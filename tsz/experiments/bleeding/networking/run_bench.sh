#!/bin/bash
# Fast benchmark runner — single pass, no loops-in-loops, raw output
set -euo pipefail
cd "$(dirname "$0")"

PIDS=()
cleanup() { kill "${PIDS[@]}" 2>/dev/null; wait 2>/dev/null; }
trap cleanup EXIT

echo "=== Building ==="
zig build-exe -OReleaseFast zig/echo_server.zig -femit-bin=zig/echo_server_bin 2>/dev/null
cat > /tmp/_zhtp.zig << 'ZIG'
const std = @import("std");
pub fn main() !void {
    const addr = std.net.Address.initIp4(.{127,0,0,1}, 9101);
    var srv = try addr.listen(.{.reuse_address=true});
    defer srv.deinit();
    while (true) {
        const c = srv.accept() catch continue;
        defer c.stream.close();
        var b: [4096]u8 = undefined;
        const n = c.stream.read(&b) catch continue;
        if (n > 0 and std.mem.startsWith(u8, b[0..n], "GET "))
            c.stream.writeAll("HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!") catch {}
        else c.stream.writeAll("HTTP/1.1 405\r\nContent-Length: 0\r\n\r\n") catch {};
    }
}
ZIG
zig build-exe -OReleaseFast /tmp/_zhtp.zig -femit-bin=zig/http_server_bin 2>/dev/null
zig build-exe -OReleaseFast bench.zig -femit-bin=bench_bin 2>/dev/null
zig build-exe -OReleaseFast zig/payload_bench.zig -femit-bin=zig/payload_bench_bin 2>/dev/null
bash quickjs/build.sh 2>/dev/null
cc -O2 -o quickjs/bridge_bench quickjs/bridge_bench.c \
    -I/tmp/quickjs-local/include -L/tmp/quickjs-local/lib -lqjs -lm -lpthread 2>/dev/null
python3 gen_payloads.py 2>/dev/null
echo "Done."
echo ""

# ─── TCP/HTTP ───
echo "=== TCP/HTTP Benchmarks ==="
zig/echo_server_bin & PIDS+=($!)
zig/http_server_bin & PIDS+=($!)
luajit -e "package.path='luajit/?.lua;'..package.path;local s=require('echo_server');local f=s.create_server(9200);while true do s.echo_accept_one(f) end" & PIDS+=($!)
luajit -e "package.path='luajit/?.lua;'..package.path;local s=require('echo_server');local f=s.create_server(9201);while true do s.http_accept_one(f) end" & PIDS+=($!)
quickjs/qjs_echo_server 9300 quickjs/ & PIDS+=($!)
quickjs/qjs_http_server 9301 quickjs/ & PIDS+=($!)
sleep 0.5

echo "| Test       | Runtime  |    Iters |  Avg (μs) |  P99 (μs) |   Throughput |  RSS KB |"
echo "|------------|----------|----------|-----------|-----------|--------------|---------|"
./bench_bin zig all 9100 2>/dev/null
./bench_bin luajit all 9200 2>/dev/null
./bench_bin quickjs all 9300 2>/dev/null

kill "${PIDS[@]}" 2>/dev/null; wait 2>/dev/null; PIDS=(); sleep 0.2
echo ""

# ─── Payload digestion — run all 45 combos as fast as possible ───
echo "=== Payload Digestion ==="
echo "Format: size/func  runtime  iters  avg_us  bridge_us  rss_kb"
echo "---"

# Collect all output at once — parallel where possible
{
    for sz in small:1000 medium:200 large:10; do
        IFS=: read s i <<< "$sz"
        for fn in parse extract validate total serialize; do
            echo -n "$s/$fn  zig      "
            ./zig/payload_bench_bin payloads/$s.json $fn $i 2>/dev/null || echo "ERROR"
            echo -n "$s/$fn  quickjs  "
            ./quickjs/bridge_bench quickjs/payload_bench.js payloads/$s.json $fn $i 2>/dev/null || echo "ERROR"
            echo -n "$s/$fn  luajit   "
            luajit luajit/payload_bench.lua payloads/$s.json $fn $i 2>/dev/null || echo "ERROR"
        done
    done
}

echo ""
echo "=== DONE ==="
