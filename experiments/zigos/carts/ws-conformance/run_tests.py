#!/usr/bin/env python3
"""
WebSocket CLIENT conformance tests.

Tests protocol behaviors from the client perspective against a built-in
raw-socket echo server. Validates the same protocol paths that websocket.zig
(the Zig WS client) must handle.

Categories:
  1.x  Connect + handshake
  2.x  Text frames
  3.x  Binary frames
  4.x  Ping/pong
  5.x  Close handshake
  6.x  Fragmented messages (server→client)
  7.x  Large messages
  8.x  Error handling
  9.x  Multiple messages

No external dependencies — uses raw sockets for both server and client.

Usage:
  python3 carts/ws-conformance/run_tests.py
"""

import base64
import hashlib
import json
import os
import socket
import struct
import sys
import threading
import time

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 9002
MAGIC_GUID = "258EAFA5-E914-47DA-95CA-5AB515859764"
RESULTS = {}
_recv_buffers = {}


# ═══════════════════════════════════════════════════════════════════════
# Built-in WS Echo Server (raw sockets, zero dependencies)
# ═══════════════════════════════════════════════════════════════════════

class EchoServer:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.sock = None
        self.running = False
        self.handler = None  # Override per-test: (client_sock, opcode, payload) -> None

    def start(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.settimeout(1)
        self.sock.bind((self.host, self.port))
        self.sock.listen(16)
        self.running = True
        threading.Thread(target=self._accept_loop, daemon=True).start()

    def stop(self):
        self.running = False
        if self.sock:
            self.sock.close()

    def _accept_loop(self):
        while self.running:
            try:
                client, _ = self.sock.accept()
                client.settimeout(5)
                threading.Thread(target=self._handle, args=(client,), daemon=True).start()
            except socket.timeout:
                continue
            except OSError:
                break

    def _handle(self, client):
        try:
            # Read HTTP upgrade request
            req = b""
            while b"\r\n\r\n" not in req:
                req += client.recv(4096)
            key = None
            for line in req.decode(errors="replace").split("\r\n"):
                if line.lower().startswith("sec-websocket-key:"):
                    key = line.split(":", 1)[1].strip()
            if not key:
                client.close()
                return
            accept = base64.b64encode(hashlib.sha1((key + MAGIC_GUID).encode()).digest()).decode()
            client.sendall(f"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {accept}\r\n\r\n".encode())

            # Frame loop
            while self.running:
                opcode, payload = self._recv_frame(client)
                if opcode == 8:
                    self._send_frame(client, 8, payload)
                    break
                elif opcode == 9:
                    self._send_frame(client, 10, payload)
                elif opcode == 10:
                    pass
                elif opcode in (1, 2):
                    if self.handler:
                        self.handler(client, opcode, payload)
                    else:
                        self._send_frame(client, opcode, payload)
        except Exception:
            pass
        finally:
            try:
                client.close()
            except Exception:
                pass

    def _recv_frame(self, sock):
        hdr = self._rx(sock, 2)
        opcode = hdr[0] & 0x0F
        masked = bool(hdr[1] & 0x80)
        length = hdr[1] & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._rx(sock, 2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._rx(sock, 8))[0]
        if masked:
            mk = self._rx(sock, 4)
            p = bytearray(self._rx(sock, length))
            for i in range(length):
                p[i] ^= mk[i % 4]
            return opcode, bytes(p)
        return opcode, self._rx(sock, length)

    def _rx(self, sock, n):
        data = b""
        while len(data) < n:
            chunk = sock.recv(n - len(data))
            if not chunk:
                raise ConnectionError("closed")
            data += chunk
        return data

    def _send_frame(self, sock, opcode, payload, fin=True):
        first = (0x80 if fin else 0) | opcode
        if len(payload) > 65535:
            hdr = struct.pack("!BB", first, 127) + struct.pack("!Q", len(payload))
        elif len(payload) > 125:
            hdr = struct.pack("!BB", first, 126) + struct.pack("!H", len(payload))
        else:
            hdr = struct.pack("!BB", first, len(payload))
        sock.sendall(hdr + payload)


# ═══════════════════════════════════════════════════════════════════════
# Client Helpers (simulate websocket.zig behavior)
# ═══════════════════════════════════════════════════════════════════════

def ws_connect():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    sock.connect((SERVER_HOST, SERVER_PORT))
    key = base64.b64encode(os.urandom(16)).decode()
    sock.sendall(f"GET / HTTP/1.1\r\nHost: {SERVER_HOST}:{SERVER_PORT}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: {key}\r\n\r\n".encode())
    resp = b""
    while b"\r\n\r\n" not in resp:
        chunk = sock.recv(4096)
        if not chunk:
            raise ConnectionError("closed during handshake")
        resp += chunk
    if b"101" not in resp.split(b"\r\n")[0]:
        raise ConnectionError(f"Not 101: {resp[:80]}")
    return sock


def ws_send(sock, opcode, payload, fin=True):
    mk = os.urandom(4)
    first = (0x80 if fin else 0) | opcode
    if len(payload) > 65535:
        hdr = struct.pack("!BB", first, 0x80 | 127) + struct.pack("!Q", len(payload))
    elif len(payload) > 125:
        hdr = struct.pack("!BB", first, 0x80 | 126) + struct.pack("!H", len(payload))
    else:
        hdr = struct.pack("!BB", first, 0x80 | len(payload))
    masked = bytes(payload[i] ^ mk[i % 4] for i in range(len(payload)))
    sock.sendall(hdr + mk + masked)


def ws_recv(sock, timeout=5):
    sock.settimeout(timeout)
    fd = sock.fileno()
    if fd not in _recv_buffers:
        _recv_buffers[fd] = b""

    def rx(n):
        buf = _recv_buffers[fd]
        while len(buf) < n:
            chunk = sock.recv(65536)
            if not chunk:
                _recv_buffers[fd] = buf
                raise ConnectionError("closed")
            buf += chunk
        result = buf[:n]
        _recv_buffers[fd] = buf[n:]
        return result

    hdr = rx(2)
    fin = bool(hdr[0] & 0x80)
    opcode = hdr[0] & 0x0F
    length = hdr[1] & 0x7F
    if length == 126:
        length = struct.unpack("!H", rx(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", rx(8))[0]
    return opcode, rx(length), fin


def ws_close(sock):
    try:
        ws_send(sock, 8, struct.pack("!H", 1000))
        sock.settimeout(1)
        try:
            sock.recv(4096)
        except Exception:
            pass
    except Exception:
        pass
    try:
        sock.close()
    except Exception:
        pass


def record(case_id, desc, passed, detail=""):
    RESULTS[case_id] = {"behavior": "OK" if passed else "FAILED", "description": desc, "detail": detail}
    mark = "PASS" if passed else "FAIL"
    print(f"  [{mark}] {case_id}: {desc}" + (f" ({detail})" if detail and not passed else ""))


# ═══════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════

def test_1_connect(srv):
    print("\n--- Category 1: Connect + Handshake ---")

    try:
        sock = ws_connect()
        record("1.1", "TCP connect + WS handshake", True)
        ws_close(sock)
    except Exception as e:
        record("1.1", "TCP connect + WS handshake", False, str(e))

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((SERVER_HOST, SERVER_PORT))
        key = base64.b64encode(os.urandom(16)).decode()
        sock.sendall(f"GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: {key}\r\n\r\n".encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            resp += sock.recv(4096)
        has_101 = b"101" in resp.split(b"\r\n")[0]
        has_accept = b"Sec-WebSocket-Accept" in resp
        record("1.2", "101 with Accept header", has_101 and has_accept,
               f"101={has_101} accept={has_accept}")
        sock.close()
    except Exception as e:
        record("1.2", "101 with Accept header", False, str(e))

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        sock.connect(("127.0.0.1", 19999))
        record("1.3", "Connection refused on bad port", False, "connected")
        sock.close()
    except (ConnectionRefusedError, socket.timeout, OSError):
        record("1.3", "Connection refused on bad port", True)


def test_2_text(srv):
    print("\n--- Category 2: Text Frames ---")

    for cid, msg, desc in [("2.1", b"Hello", "Small text"), ("2.2", b"", "Empty text"),
                            ("2.3", "Hello 世界 🌍".encode(), "UTF-8 text"),
                            ("2.4", b"x" * 200, "Medium text (200B)")]:
        try:
            sock = ws_connect()
            ws_send(sock, 1, msg)
            op, payload, _ = ws_recv(sock)
            record(cid, desc, op == 1 and payload == msg, f"len={len(payload)}" if payload != msg else "")
            ws_close(sock)
        except Exception as e:
            record(cid, desc, False, str(e))


def test_3_binary(srv):
    print("\n--- Category 3: Binary Frames ---")

    try:
        sock = ws_connect()
        msg = bytes(range(256))
        ws_send(sock, 2, msg)
        op, payload, _ = ws_recv(sock)
        record("3.1", "256B binary echo", op == 2 and payload == msg)
        ws_close(sock)
    except Exception as e:
        record("3.1", "256B binary echo", False, str(e))

    try:
        sock = ws_connect()
        ws_send(sock, 2, b"")
        op, payload, _ = ws_recv(sock)
        record("3.2", "Empty binary", op == 2 and payload == b"")
        ws_close(sock)
    except Exception as e:
        record("3.2", "Empty binary", False, str(e))


def test_4_ping(srv):
    print("\n--- Category 4: Ping/Pong ---")

    for cid, data, desc in [("4.1", b"ping!", "Ping with payload"),
                             ("4.2", b"", "Empty ping"),
                             ("4.3", b"P" * 125, "Ping 125B (max)")]:
        try:
            sock = ws_connect()
            ws_send(sock, 9, data)
            op, payload, _ = ws_recv(sock)
            record(cid, desc, op == 10 and payload == data, f"op={op}")
            ws_close(sock)
        except Exception as e:
            record(cid, desc, False, str(e))


def test_5_close(srv):
    print("\n--- Category 5: Close Handshake ---")

    try:
        sock = ws_connect()
        ws_send(sock, 8, struct.pack("!H", 1000) + b"normal")
        op, payload, _ = ws_recv(sock)
        code = struct.unpack("!H", payload[:2])[0] if len(payload) >= 2 else 0
        record("5.1", "Client close echoed", op == 8, f"code={code}")
        sock.close()
    except Exception as e:
        record("5.1", "Client close echoed", False, str(e))

    try:
        sock = ws_connect()
        ws_send(sock, 8, b"")
        op, _, _ = ws_recv(sock)
        record("5.2", "Close empty body", op == 8)
        sock.close()
    except Exception as e:
        record("5.2", "Close empty body", False, str(e))

    # 5.3: Server-initiated close
    def close_handler(client, opcode, payload):
        if payload == b"CLOSE_ME":
            srv._send_frame(client, 8, struct.pack("!H", 1000) + b"bye")
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = close_handler
    try:
        sock = ws_connect()
        ws_send(sock, 1, b"CLOSE_ME")
        op, payload, _ = ws_recv(sock)
        record("5.3", "Server-initiated close", op == 8)
        ws_send(sock, 8, payload)  # Echo close back
        sock.close()
    except Exception as e:
        record("5.3", "Server-initiated close", False, str(e))
    srv.handler = None

    try:
        sock = ws_connect()
        ws_send(sock, 8, struct.pack("!H", 1001) + b"going away")
        op, _, _ = ws_recv(sock)
        record("5.4", "Close with reason", op == 8)
        sock.close()
    except Exception as e:
        record("5.4", "Close with reason", False, str(e))


def test_6_fragmentation(srv):
    print("\n--- Category 6: Fragmented Messages (server→client) ---")

    # 6.1: Two fragments
    def frag2(client, opcode, payload):
        if payload == b"FRAG2":
            srv._send_frame(client, 1, b"Hel", fin=False)
            srv._send_frame(client, 0, b"lo", fin=True)
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = frag2
    try:
        sock = ws_connect()
        ws_send(sock, 1, b"FRAG2")
        full = b""
        while True:
            op, payload, fin = ws_recv(sock)
            full += payload
            if fin:
                break
        record("6.1", "2 server fragments reassembled", full == b"Hello", f"got={full!r}")
        ws_close(sock)
    except Exception as e:
        record("6.1", "2 server fragments reassembled", False, str(e))

    # 6.2: Three fragments
    def frag3(client, opcode, payload):
        if payload == b"FRAG3":
            srv._send_frame(client, 1, b"AB", fin=False)
            srv._send_frame(client, 0, b"CD", fin=False)
            srv._send_frame(client, 0, b"EF", fin=True)
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = frag3
    try:
        sock = ws_connect()
        ws_send(sock, 1, b"FRAG3")
        full = b""
        while True:
            _, payload, fin = ws_recv(sock)
            full += payload
            if fin:
                break
        record("6.2", "3 server fragments reassembled", full == b"ABCDEF", f"got={full!r}")
        ws_close(sock)
    except Exception as e:
        record("6.2", "3 server fragments reassembled", False, str(e))

    # 6.3: Ping interleaved with fragments
    def frag_ping(client, opcode, payload):
        if payload == b"FRAG_PING":
            srv._send_frame(client, 1, b"part1", fin=False)
            srv._send_frame(client, 10, b"pong!")  # Pong (control, always FIN)
            srv._send_frame(client, 0, b"part2", fin=True)
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = frag_ping
    try:
        sock = ws_connect()
        ws_send(sock, 1, b"FRAG_PING")
        # Should get: fragment(part1) + pong + fragment(part2)
        frames = []
        for _ in range(3):
            op, payload, fin = ws_recv(sock)
            frames.append((op, payload, fin))
        # Pong can arrive between fragments
        data_frames = [(o, p) for o, p, f in frames if o in (1, 0)]
        pong_frames = [(o, p) for o, p, f in frames if o == 10]
        full = b"".join(p for _, p in data_frames)
        record("6.3", "Ping interleaved in fragments", full == b"part1part2" and len(pong_frames) == 1,
               f"data={full!r} pongs={len(pong_frames)}")
        ws_close(sock)
    except Exception as e:
        record("6.3", "Ping interleaved in fragments", False, str(e))
    srv.handler = None


def test_7_large(srv):
    print("\n--- Category 7: Large Messages ---")

    try:
        sock = ws_connect()
        msg = b"A" * 65535
        ws_send(sock, 1, msg)
        _, payload, _ = ws_recv(sock)
        record("7.1", "64KB text echo", payload == msg, f"len={len(payload)}")
        ws_close(sock)
    except Exception as e:
        record("7.1", "64KB text echo", False, str(e))

    try:
        sock = ws_connect()
        msg = os.urandom(65535)
        ws_send(sock, 2, msg)
        _, payload, _ = ws_recv(sock)
        record("7.2", "64KB binary echo", payload == msg, f"len={len(payload)}")
        ws_close(sock)
    except Exception as e:
        record("7.2", "64KB binary echo", False, str(e))


def test_8_errors(srv):
    print("\n--- Category 8: Error Handling ---")

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        sock.connect(("127.0.0.1", 19999))
        record("8.1", "Connection refused", False, "connected")
    except (ConnectionRefusedError, socket.timeout, OSError):
        record("8.1", "Connection refused", True)

    # 8.2: Server drops connection
    def dropper(client, opcode, payload):
        if payload == b"DROP":
            client.close()
            raise Exception("drop")
        srv._send_frame(client, opcode, payload)
    srv.handler = dropper
    try:
        sock = ws_connect()
        ws_send(sock, 1, b"DROP")
        try:
            ws_recv(sock, timeout=2)
            record("8.2", "Detect server drop", False, "got data")
        except (ConnectionError, socket.timeout):
            record("8.2", "Detect server drop", True)
        sock.close()
    except Exception as e:
        record("8.2", "Detect server drop", True, str(e))
    srv.handler = None


def test_9_multi(srv):
    print("\n--- Category 9: Multiple Messages ---")

    try:
        sock = ws_connect()
        ok = True
        for i in range(10):
            msg = f"seq-{i}".encode()
            ws_send(sock, 1, msg)
            _, p, _ = ws_recv(sock)
            if p != msg:
                ok = False
                break
        record("9.1", "10 sequential messages", ok)
        ws_close(sock)
    except Exception as e:
        record("9.1", "10 sequential messages", False, str(e))

    try:
        sock = ws_connect()
        count = 50
        for i in range(count):
            ws_send(sock, 1, f"r{i:04d}".encode())
        ok = True
        for i in range(count):
            _, p, _ = ws_recv(sock)
            if p != f"r{i:04d}".encode():
                ok = False
                break
        record("9.2", f"{count} rapid-fire messages", ok)
        ws_close(sock)
    except Exception as e:
        record("9.2", f"{count} rapid-fire messages", False, str(e))

    try:
        sock = ws_connect()
        ws_send(sock, 1, b"text1")
        ws_send(sock, 2, b"\x00\x01\x02")
        ws_send(sock, 1, b"text2")
        o1, p1, _ = ws_recv(sock)
        o2, p2, _ = ws_recv(sock)
        o3, p3, _ = ws_recv(sock)
        ok = (o1 == 1 and p1 == b"text1" and o2 == 2 and p2 == b"\x00\x01\x02" and o3 == 1 and p3 == b"text2")
        record("9.3", "Mixed text + binary", ok)
        ws_close(sock)
    except Exception as e:
        record("9.3", "Mixed text + binary", False, str(e))


# ═══════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════

def main():
    print("WebSocket CLIENT Conformance Tests")
    print(f"Test server: ws://{SERVER_HOST}:{SERVER_PORT}\n")

    srv = EchoServer(SERVER_HOST, SERVER_PORT)
    srv.start()
    time.sleep(0.3)
    print("Echo server started.")

    try:
        test_1_connect(srv)
        test_2_text(srv)
        test_3_binary(srv)
        test_4_ping(srv)
        test_5_close(srv)
        test_6_fragmentation(srv)
        test_7_large(srv)
        test_8_errors(srv)
        test_9_multi(srv)
    finally:
        srv.stop()

    total = len(RESULTS)
    passed = sum(1 for v in RESULTS.values() if v["behavior"] == "OK")
    failed = total - passed

    print(f"\n{'='*60}")
    print(f"RESULTS: {passed}/{total} passed ({failed} failed)")
    print(f"{'='*60}")

    if failed:
        print(f"\nFailed:")
        for cid, info in sorted(RESULTS.items()):
            if info["behavior"] != "OK":
                print(f"  {cid}: {info['description']} -- {info['detail']}")

    results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports")
    os.makedirs(results_dir, exist_ok=True)
    with open(os.path.join(results_dir, "results.json"), "w") as f:
        json.dump({"total": total, "passed": passed, "failed": failed, "cases": RESULTS}, f, indent=2)
    print(f"\nResults saved to {results_dir}/results.json")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
