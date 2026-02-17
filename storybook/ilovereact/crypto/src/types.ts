/** Encrypted data envelope */
export interface EncryptedData {
  /** Encryption algorithm used */
  algorithm: 'aes-256-gcm' | 'chacha20-poly1305' | 'xchacha20-poly1305';
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded nonce/IV */
  nonce: string;
  /** Base64-encoded salt (for password-derived keys) */
  salt: string;
  /** KDF parameters */
  kdf: 'scrypt' | 'pbkdf2';
  /** KDF iteration count / cost factor */
  kdfParams: { N?: number; r?: number; p?: number; iterations?: number };
}

/** Key pair for asymmetric operations */
export interface KeyPair {
  /** Hex-encoded public key */
  publicKey: string;
  /** Hex-encoded private key */
  privateKey: string;
  /** Curve used */
  curve: 'ed25519' | 'x25519' | 'secp256k1';
}

/** Signed message */
export interface SignedMessage {
  /** Original message */
  message: string;
  /** Hex-encoded signature */
  signature: string;
  /** Hex-encoded public key of signer */
  publicKey: string;
  /** Signature algorithm */
  algorithm: 'ed25519';
}

/** Hash result */
export interface HashResult {
  /** Hex-encoded hash */
  hex: string;
  /** Base64-encoded hash */
  base64: string;
  /** Raw bytes */
  bytes: Uint8Array;
}

/** Options for password-based encryption */
export interface EncryptOptions {
  /** Encryption algorithm. Default: 'aes-256-gcm' */
  algorithm?: 'aes-256-gcm' | 'chacha20-poly1305' | 'xchacha20-poly1305';
}

/** Options for useEncrypt/useDecrypt hooks */
export interface CryptoHookResult<T> {
  execute: (...args: any[]) => Promise<T>;
  loading: boolean;
  error: Error | null;
  result: T | null;
}
