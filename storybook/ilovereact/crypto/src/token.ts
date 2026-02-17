/**
 * Secure token/password generation — @noble/hashes randomBytes.
 */

import { randomBytes, bytesToHex } from '@noble/hashes/utils';
import { toBase64 } from './encoding';

/**
 * Generate a cryptographically random hex token.
 *
 * @example
 * const token = randomToken(32); // 64 hex chars
 */
export function randomToken(bytes: number = 32): string {
  return bytesToHex(randomBytes(bytes));
}

/**
 * Generate a cryptographically random base64 token.
 *
 * @example
 * const token = randomBase64(32); // ~43 base64 chars
 */
export function randomBase64(bytes: number = 32): string {
  return toBase64(randomBytes(bytes));
}

/**
 * Generate a URL-safe random string (alphanumeric).
 *
 * @example
 * const id = randomId(16); // 16 alphanumeric chars
 */
export function randomId(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) result += chars[bytes[i] % chars.length];
  return result;
}
