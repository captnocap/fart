/**
 * Encoding utilities — hex, base64, UTF-8.
 * Hex re-exports from @noble/hashes. Base64 is a pure format conversion (not crypto).
 */

import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// Re-export noble's hex utils
export { bytesToHex as toHex, hexToBytes as fromHex };

// ── Base64 (format conversion, not cryptography) ────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    result += B64[(a >> 2) & 63];
    result += B64[((a << 4) | (b >> 4)) & 63];
    result += i + 1 < len ? B64[((b << 2) | (c >> 6)) & 63] : '=';
    result += i + 2 < len ? B64[c & 63] : '=';
  }
  return result;
}

export function fromBase64(str: string): Uint8Array {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;

  let len = str.length;
  while (len > 0 && str[len - 1] === '=') len--;

  const bytes = new Uint8Array(Math.floor(len * 3 / 4));
  let j = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[str.charCodeAt(i)];
    const b = i + 1 < len ? lookup[str.charCodeAt(i + 1)] : 0;
    const c = i + 2 < len ? lookup[str.charCodeAt(i + 2)] : 0;
    const d = i + 3 < len ? lookup[str.charCodeAt(i + 3)] : 0;
    bytes[j++] = (a << 2) | (b >> 4);
    if (i + 2 < len) bytes[j++] = ((b << 4) | (c >> 2)) & 255;
    if (i + 3 < len) bytes[j++] = ((c << 6) | d) & 255;
  }
  return bytes.slice(0, j);
}
