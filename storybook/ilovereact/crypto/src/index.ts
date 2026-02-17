// ── Types ───────────────────────────────────────────────
export type {
  EncryptedData,
  KeyPair,
  SignedMessage,
  HashResult,
  EncryptOptions,
} from './types';

// ── Hashing (@noble/hashes) ────────────────────────────
export {
  sha256,
  sha512,
  hash_blake2b,
  hash_blake2s,
  hash_blake3,
  hmacSHA256,
  hmacSHA512,
  timingSafeEqual,
} from './hash';

// ── Symmetric Encryption (@noble/ciphers) ──────────────
export {
  encrypt,
  decrypt,
  encryptRaw,
  decryptRaw,
  randomBytes,
} from './encrypt';

// ── Signing & Key Exchange (@noble/curves) ─────────────
export {
  generateSigningKeys,
  sign,
  verify,
  verifyDetached,
  generateDHKeys,
  diffieHellman,
} from './sign';

// ── Token Generation ───────────────────────────────────
export { randomToken, randomBase64, randomId } from './token';

// ── Encoding ───────────────────────────────────────────
export { toHex, fromHex, toBase64, fromBase64 } from './encoding';
