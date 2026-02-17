/**
 * Hash functions — thin wrappers over @noble/hashes.
 * Audited, battle-tested implementations.
 */

import { sha256 as _sha256 } from '@noble/hashes/sha256';
import { sha512 as _sha512 } from '@noble/hashes/sha512';
import { blake2b } from '@noble/hashes/blake2b';
import { blake2s } from '@noble/hashes/blake2s';
import { blake3 } from '@noble/hashes/blake3';
import { hmac as _hmac } from '@noble/hashes/hmac';
import { bytesToHex } from '@noble/hashes/utils';
import { toBase64 } from './encoding';
import type { HashResult } from './types';

function toHashResult(bytes: Uint8Array): HashResult {
  return { hex: bytesToHex(bytes), base64: toBase64(bytes), bytes };
}

function toBytes(input: string | Uint8Array): Uint8Array {
  return typeof input === 'string' ? new TextEncoder().encode(input) : input;
}

/**
 * SHA-256.
 * @example
 * sha256('hello').hex // 'b94d27b9...'
 */
export function sha256(input: string | Uint8Array): HashResult {
  return toHashResult(_sha256(toBytes(input)));
}

/**
 * SHA-512.
 * @example
 * sha512('hello').hex
 */
export function sha512(input: string | Uint8Array): HashResult {
  return toHashResult(_sha512(toBytes(input)));
}

/**
 * BLAKE2b (64-byte default).
 * @example
 * blake2b256('hello').hex
 */
export function hash_blake2b(input: string | Uint8Array, bytes: number = 32): HashResult {
  return toHashResult(blake2b(toBytes(input), { dkLen: bytes }));
}

/**
 * BLAKE2s (32-byte).
 */
export function hash_blake2s(input: string | Uint8Array): HashResult {
  return toHashResult(blake2s(toBytes(input)));
}

/**
 * BLAKE3 (32-byte default).
 */
export function hash_blake3(input: string | Uint8Array, bytes: number = 32): HashResult {
  return toHashResult(blake3(toBytes(input), { dkLen: bytes }));
}

/**
 * HMAC-SHA256.
 * @example
 * hmacSHA256('secret', 'message').hex
 */
export function hmacSHA256(key: string | Uint8Array, message: string | Uint8Array): HashResult {
  return toHashResult(_hmac(_sha256, toBytes(key), toBytes(message)));
}

/**
 * HMAC-SHA512.
 */
export function hmacSHA512(key: string | Uint8Array, message: string | Uint8Array): HashResult {
  return toHashResult(_hmac(_sha512, toBytes(key), toBytes(message)));
}

/**
 * Timing-safe comparison.
 */
export function timingSafeEqual(a: string | Uint8Array, b: string | Uint8Array): boolean {
  const ab = toBytes(a);
  const bb = toBytes(b);
  if (ab.length !== bb.length) return false;
  let result = 0;
  for (let i = 0; i < ab.length; i++) result |= ab[i] ^ bb[i];
  return result === 0;
}
