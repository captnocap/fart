# Privacy Stack for tsz

## CRITICAL: Privacy UI is .tsz — system logic is Zig

Same rule as devtools/terminal: any UI for privacy features (keyring manager, PII redaction display, audit log viewer) is `.tsz`. Only system-level crypto, file I/O, subprocess management, and network protocols are Zig.

## What Love2D Has (~4,000 lines)

| File | Lines | What |
|------|-------|------|
| `love2d/lua/privacy.lua` | 2,318 | Master toolkit: secure memory, HKDF, Shamir SSS, file encryption, keyring, GPG, Noise protocol, steganography, PII detection, audit logging, retention policies |
| `love2d/lua/peer_tunnel.lua` | 681 | Encrypted P2P over UDP — X25519 + XChaCha20-Poly1305 + STUN NAT traversal |
| `love2d/lua/stun.lua` | 256 | STUN client for public IP discovery (RFC 5389) |
| `love2d/lua/tor.lua` | 263 | Already in networking plan (completed) |
| `love2d/lua/socks5.lua` | 324 | Already implemented (networking phases 3-4) |
| `love2d/packages/wireguard/` | ~300 | Two-tier P2P: real WireGuard (kernel) + userspace libsodium tunnel |
| `love2d/packages/privacy/` | ~400 | React hooks wrapping all privacy functions |

## Dependency: Crypto Plan Must Land First

The privacy stack is built ON TOP of crypto primitives. `crypto.zig` (from the crypto plan) provides:
- SHA-256/512, BLAKE2b/3 → used by file hashing, audit chains
- HMAC-SHA256 → used by audit logging, HKDF
- XChaCha20-Poly1305 → used by file encryption, peer tunnel, keyring
- Ed25519 → used by signing
- X25519 → used by peer tunnel, Noise protocol, WireGuard identity
- Argon2 → used by keyring password derivation
- `std.crypto.random` → used everywhere

**Do not start this until `crypto.zig` is landed.**

## Implementation Phases

### Phase 1: HKDF (Key Derivation)

**File: `tsz/runtime/privacy.zig`**

HKDF-SHA256 (RFC 5869) — extract-then-expand key derivation.

Reference: `love2d/lua/privacy.lua:337-368`

```zig
pub fn hkdfExtract(salt: []const u8, ikm: []const u8) [32]u8 {
    return crypto.hmacSha256(salt, ikm);
}

pub fn hkdfExpand(prk: [32]u8, info: []const u8, comptime length: usize) [length]u8 {
    // HMAC-based expansion per RFC 5869
}

pub fn hkdfDerive(ikm: []const u8, salt: []const u8, info: []const u8, comptime length: usize) [length]u8 {
    const prk = hkdfExtract(salt, ikm);
    return hkdfExpand(prk, info, length);
}
```

Zig may have this in `std.crypto.kdf` — check first before implementing.

### Phase 2: Shamir's Secret Sharing

**File: `tsz/runtime/privacy.zig`**

GF(256) arithmetic with Lagrange interpolation. Split a secret into N shares, any K can reconstruct.

Reference: `love2d/lua/privacy.lua:384-481`

```zig
pub const Share = struct {
    x: u8,           // share index (1-255)
    data: [256]u8,   // share bytes (same length as secret)
    len: u8,
};

pub fn shamirSplit(secret: []const u8, n: u8, k: u8, shares_out: []Share) void;
pub fn shamirCombine(shares: []const Share, out: []u8) []const u8;
```

GF(256) with generator 3 (AES primitive):
- `gf_mul(a, b)` — multiplication via log/exp tables
- `gf_inv(a)` — multiplicative inverse
- Lagrange interpolation at x=0 to recover secret

Reference: `love2d/lua/privacy.lua:384-401` (GF arithmetic), `love2d/lua/privacy.lua:423-481` (split/combine)

### Phase 3: File Encryption (Streaming AEAD)

**File: `tsz/runtime/privacy.zig`**

Encrypt/decrypt files in 64KB chunks using XChaCha20-Poly1305.

Reference: `love2d/lua/privacy.lua:505-555`

```zig
pub fn encryptFile(input_path: []const u8, output_path: []const u8, key: [32]u8) !void;
pub fn decryptFile(input_path: []const u8, output_path: []const u8, key: [32]u8) !void;
```

Uses `std.fs` for file I/O + `std.crypto.aead.xchacha20poly1305` for encryption. Writes header with nonce, then encrypted chunks.

### Phase 4: Encrypted Keyring

**File: `tsz/runtime/keyring.zig`**

Master-password-protected key storage. Stores Ed25519/X25519 keys with metadata.

Reference: `love2d/lua/privacy.lua:916-1050` (keyring create/open/generate/rotate/revoke)

```zig
pub const KeyEntry = struct {
    name: [64]u8,
    name_len: u8,
    key_type: enum { ed25519, x25519 },
    public_key: [32]u8,
    secret_key: [64]u8,  // encrypted at rest
    created_at: i64,
    expires_at: ?i64,
    revoked: bool,
};

pub fn keyringCreate(path: []const u8, password: []const u8) !void;
pub fn keyringOpen(path: []const u8, password: []const u8) !Keyring;
pub fn keyringGenerateKey(kr: *Keyring, name: []const u8, key_type: KeyType) !void;
pub fn keyringRotateKey(kr: *Keyring, name: []const u8) !void;
pub fn keyringRevokeKey(kr: *Keyring, name: []const u8, reason: []const u8) !void;
pub fn keyringSave(kr: *Keyring) !void;
```

Storage: encrypted file on disk. Master password → Argon2 → AES key → encrypt keyring data.

### Phase 5: PII Detection & Redaction

**File: `tsz/runtime/privacy.zig`**

Pattern-based detection of emails, SSNs, credit cards, phone numbers, IPs.

Reference: `love2d/lua/privacy.lua:1466-1530`

This is pure string matching — no crypto needed. Can be done with simple byte scanning:

```zig
pub const PIIType = enum { email, ssn, credit_card, phone, ipv4 };

pub const PIIMatch = struct {
    kind: PIIType,
    start: usize,
    end: usize,
};

pub fn detectPII(text: []const u8, out: []PIIMatch) usize;
pub fn redactPII(text: []const u8, matches: []const PIIMatch, out: []u8) []const u8;
```

### Phase 6: Audit Logging (HMAC-chained)

**File: `tsz/runtime/audit.zig`**

Tamper-evident append-only log. Each entry's HMAC includes the previous entry's hash.

Reference: `love2d/lua/privacy.lua:1600-1650`

```zig
pub const AuditEntry = struct {
    timestamp: i64,
    event: [256]u8,
    event_len: u16,
    hash: [32]u8,      // HMAC-SHA256(prev_hash || event || timestamp)
};

pub fn auditCreate(path: []const u8, hmac_key: [32]u8) !AuditLog;
pub fn auditAppend(log: *AuditLog, event: []const u8) !void;
pub fn auditVerify(log: *AuditLog) !bool;  // detect tampering
```

### Phase 7: Peer-to-Peer Encrypted Tunnel

**New file: `tsz/runtime/net/peer_tunnel.zig`**

Encrypted UDP communication with STUN-based NAT traversal.

Reference: `love2d/lua/peer_tunnel.lua` (681 lines), `love2d/lua/stun.lua` (256 lines)

```zig
pub fn create(config: TunnelConfig) !PeerTunnel;
pub fn addPeer(tunnel: *PeerTunnel, public_key: [32]u8, endpoint: ?Endpoint) void;
pub fn send(tunnel: *PeerTunnel, peer_key: [32]u8, data: []const u8) !void;
pub fn broadcast(tunnel: *PeerTunnel, data: []const u8) !void;
pub fn poll(tunnel: *PeerTunnel, events_out: []PeerEvent) usize;
pub fn destroy(tunnel: *PeerTunnel) void;
```

Wire protocol (reference: `peer_tunnel.lua:142-172`):
- `0x01` handshake: exchange X25519 public keys
- `0x02` data: `[type(1) | nonce(24) | ciphertext]`
- `0x03` keepalive: `[type(1)]`

STUN client (reference: `stun.lua:136-228`):
- Query STUN server for public IP:port
- Non-blocking state machine (resolving → sending → receiving → done)
- 3 retries, 5s timeout

Needs: `std.net` for UDP sockets, `std.crypto` for X25519 + XChaCha20-Poly1305

### Phase 8: Secure Delete & Metadata Stripping

**File: `tsz/runtime/privacy.zig`**

```zig
pub fn secureDelete(path: []const u8, passes: u8) !void;  // multi-pass overwrite
pub fn metaStrip(path: []const u8) !void;                  // shell-out to exiftool
```

Reference: `love2d/lua/privacy.lua:608-630` (secure delete), `love2d/lua/privacy.lua:1830-1847` (metadata)

### Deferred

| Feature | Why |
|---------|-----|
| **GPG integration** | Shell-out to `gpg` CLI — simple but low priority |
| **Noise protocol** | Full handshake protocol — complex, needed for advanced P2P |
| **Steganography** | Fun but niche — LSB embedding in images |
| **WireGuard kernel** | Needs root/CAP_NET_ADMIN — separate from userspace tunnel |
| **Retention/consent policies** | Application-level — can be .tsz components |

## Files

**Zig (system/crypto only):**
| File | What |
|------|------|
| `tsz/runtime/privacy.zig` | **New** — HKDF, Shamir, file encryption, PII detection, secure delete |
| `tsz/runtime/keyring.zig` | **New** — encrypted key storage with rotation/revocation |
| `tsz/runtime/audit.zig` | **New** — HMAC-chained tamper-evident logging |
| `tsz/runtime/net/peer_tunnel.zig` | **New** — encrypted P2P UDP + STUN |
| `tsz/runtime/net/stun.zig` | **New** — STUN client for NAT traversal |
| `tsz/compiler/codegen.zig` | Register privacy built-in functions |

**All uses `std.crypto` — zero external dependencies (same as crypto plan).**

## Implementation Order

```
Crypto plan (prerequisite) → must land first

Phase 1: HKDF              → foundation for key derivation
Phase 2: Shamir SSS         → secret splitting (standalone)
Phase 3: File encryption    → streaming AEAD (needs HKDF for key derivation)
Phase 4: Keyring            → needs file encryption + Argon2
Phase 5: PII detection      → pure string matching (standalone)
Phase 6: Audit logging      → needs HMAC (standalone)
Phase 7: Peer tunnel        → needs X25519 + XChaCha20 + STUN
Phase 8: Secure delete      → standalone
```

Phases 1-3 sequential (dependencies). Phases 4-8 can parallel.

## Agent Split

| Agent | Phases | Files |
|-------|--------|-------|
| A | 1-4 | `privacy.zig` (HKDF, Shamir, file encryption), `keyring.zig` |
| B | 5-6, 8 | `privacy.zig` (PII, secure delete), `audit.zig` |
| C | 7 | `peer_tunnel.zig`, `stun.zig` |

A first (crypto foundations). B and C can parallel after Phase 1.

## Verification

```bash
zig test tsz/runtime/privacy.zig    # HKDF vectors, Shamir round-trip, PII detection
zig test tsz/runtime/keyring.zig    # Create, open, generate, rotate, verify
zig test tsz/runtime/audit.zig      # Append, verify, detect tampering
zig test tsz/runtime/net/peer_tunnel.zig  # Handshake, encrypt/decrypt, keepalive
```
