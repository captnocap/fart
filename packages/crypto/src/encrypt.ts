/**
 * Symmetric encryption — thin wrappers over @noble/ciphers + @noble/hashes.
 *
 * Password-based encryption using scrypt KDF.
 * AES-256-GCM and ChaCha20-Poly1305.
 */

import { gcm } from '@noble/ciphers/aes.js';
import { chacha20poly1305, xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scrypt } from '@noble/hashes/scrypt.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { toBase64, fromBase64 } from './encoding';
import type { EncryptedData, EncryptOptions } from './types';

const SALT_LEN = 32;
const NONCE_LEN_AES = 12;
const NONCE_LEN_CHACHA = 12;
const NONCE_LEN_XCHACHA = 24;
const SCRYPT_N = 2 ** 17; // 131072 — strong default
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  const passBytes = new TextEncoder().encode(password);
  return scrypt(passBytes, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dkLen: 32 });
}

function getNonceLen(algo: EncryptedData['algorithm']): number {
  if (algo === 'xchacha20-poly1305') return NONCE_LEN_XCHACHA;
  if (algo === 'chacha20-poly1305') return NONCE_LEN_CHACHA;
  return NONCE_LEN_AES;
}

function getCipher(algo: EncryptedData['algorithm'], key: Uint8Array, nonce: Uint8Array) {
  if (algo === 'chacha20-poly1305') return chacha20poly1305(key, nonce);
  if (algo === 'xchacha20-poly1305') return xchacha20poly1305(key, nonce);
  return gcm(key, nonce);
}

/**
 * Encrypt a string with a password.
 *
 * @example
 * const encrypted = encrypt('my secret data', 'strong-password');
 * // Returns an EncryptedData envelope (JSON-serializable)
 *
 * @example
 * // ChaCha20-Poly1305 (faster on platforms without AES-NI)
 * const encrypted = encrypt(data, password, { algorithm: 'chacha20-poly1305' });
 */
export function encrypt(
  plaintext: string,
  password: string,
  options?: EncryptOptions,
): EncryptedData {
  const algo = options?.algorithm ?? 'aes-256-gcm';
  const salt = randomBytes(SALT_LEN);
  const nonceLen = getNonceLen(algo);
  const nonce = randomBytes(nonceLen);
  const key = deriveKey(password, salt);

  const plaintextBytes = new TextEncoder().encode(plaintext);
  const cipher = getCipher(algo, key, nonce);
  const ciphertext = cipher.encrypt(plaintextBytes);

  return {
    algorithm: algo,
    ciphertext: toBase64(ciphertext),
    nonce: toBase64(nonce),
    salt: toBase64(salt),
    kdf: 'scrypt',
    kdfParams: { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
  };
}

/**
 * Decrypt an EncryptedData envelope with a password.
 *
 * @example
 * const plaintext = decrypt(encrypted, 'strong-password');
 */
export function decrypt(data: EncryptedData, password: string): string {
  const salt = fromBase64(data.salt);
  const nonce = fromBase64(data.nonce);
  const ciphertext = fromBase64(data.ciphertext);

  const key = scrypt(
    new TextEncoder().encode(password),
    salt,
    {
      N: data.kdfParams.N ?? SCRYPT_N,
      r: data.kdfParams.r ?? SCRYPT_R,
      p: data.kdfParams.p ?? SCRYPT_P,
      dkLen: 32,
    },
  );

  const cipher = getCipher(data.algorithm, key, nonce);
  const plaintext = cipher.decrypt(ciphertext);
  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypt raw bytes with a key (no KDF — you manage the key).
 *
 * @example
 * const key = randomBytes(32);
 * const { ciphertext, nonce } = encryptRaw(data, key);
 */
export function encryptRaw(
  plaintext: Uint8Array,
  key: Uint8Array,
  algo: EncryptedData['algorithm'] = 'aes-256-gcm',
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = randomBytes(getNonceLen(algo));
  const cipher = getCipher(algo, key, nonce);
  return { ciphertext: cipher.encrypt(plaintext), nonce };
}

/**
 * Decrypt raw bytes with a key.
 */
export function decryptRaw(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  algo: EncryptedData['algorithm'] = 'aes-256-gcm',
): Uint8Array {
  const cipher = getCipher(algo, key, nonce);
  return cipher.decrypt(ciphertext);
}

/** Re-export randomBytes from noble */
export { randomBytes };
