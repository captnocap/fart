/**
 * Digital signatures and key exchange — @noble/curves.
 * Ed25519 for signing, X25519 for Diffie-Hellman key exchange.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js';
import type { KeyPair, SignedMessage } from './types';

/**
 * Generate an Ed25519 key pair for signing.
 *
 * @example
 * const keys = generateSigningKeys();
 * const signed = sign(keys.privateKey, 'hello');
 * verify(signed); // true
 */
export function generateSigningKeys(): KeyPair {
  const privateKey = randomBytes(32);
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
    curve: 'ed25519',
  };
}

/**
 * Sign a message with an Ed25519 private key.
 *
 * @example
 * const signed = sign(keys.privateKey, 'important message');
 */
export function sign(privateKeyHex: string, message: string): SignedMessage {
  const privateKey = hexToBytes(privateKeyHex);
  const msgBytes = new TextEncoder().encode(message);
  const signature = ed25519.sign(msgBytes, privateKey);
  const publicKey = ed25519.getPublicKey(privateKey);

  return {
    message,
    signature: bytesToHex(signature),
    publicKey: bytesToHex(publicKey),
    algorithm: 'ed25519',
  };
}

/**
 * Verify an Ed25519 signed message.
 *
 * @example
 * const valid = verify(signedMessage);
 */
export function verify(signed: SignedMessage): boolean {
  const sigBytes = hexToBytes(signed.signature);
  const pubBytes = hexToBytes(signed.publicKey);
  const msgBytes = new TextEncoder().encode(signed.message);
  return ed25519.verify(sigBytes, msgBytes, pubBytes);
}

/**
 * Verify a detached signature.
 */
export function verifyDetached(
  message: string,
  signatureHex: string,
  publicKeyHex: string,
): boolean {
  const sigBytes = hexToBytes(signatureHex);
  const pubBytes = hexToBytes(publicKeyHex);
  const msgBytes = new TextEncoder().encode(message);
  return ed25519.verify(sigBytes, msgBytes, pubBytes);
}

/**
 * Generate an X25519 key pair for Diffie-Hellman key exchange.
 *
 * @example
 * const alice = generateDHKeys();
 * const bob = generateDHKeys();
 * const sharedA = diffieHellman(alice.privateKey, bob.publicKey);
 * const sharedB = diffieHellman(bob.privateKey, alice.publicKey);
 * // sharedA === sharedB
 */
export function generateDHKeys(): KeyPair {
  const privateKey = randomBytes(32);
  const publicKey = x25519.getPublicKey(privateKey);
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
    curve: 'x25519',
  };
}

/**
 * X25519 Diffie-Hellman key exchange.
 * Returns a shared secret (hex) from your private key + their public key.
 */
export function diffieHellman(privateKeyHex: string, publicKeyHex: string): string {
  const shared = x25519.getSharedSecret(
    hexToBytes(privateKeyHex),
    hexToBytes(publicKeyHex),
  );
  return bytesToHex(shared);
}
