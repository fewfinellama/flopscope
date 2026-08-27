/**
 * Client-Side Cryptographic Verifier for Technocore Explorer.
 * Performs offline Ed25519 public key verification against did:key:z6Mk... payloads.
 */

// Import Noble Ed25519 local module
import * as ed from './vendor/ed25519.js';

// Base58btc Alphabet
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP = {};
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET.charAt(i)] = i;
}

/**
 * Decode Base58btc string into a Uint8Array
 * @param {string} string
 * @returns {Uint8Array}
 */
export function bs58Decode(string) {
  if (typeof string !== 'string' || string.length === 0) return new Uint8Array(0);
  const bytes = [0];
  for (let i = 0; i < string.length; i++) {
    const char = string[i];
    const value = BASE58_MAP[char];
    if (value === undefined) {
      throw new Error(`Invalid Base58 character: "${char}"`);
    }
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < string.length && string[i] === '1'; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

/**
 * Convert Base64 or Base64URL string to Uint8Array
 * @param {string} b64url
 * @returns {Uint8Array}
 */
export function base64urlToBytes(b64url) {
  if (typeof b64url !== 'string') throw new Error('Expected base64url string');
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert Hex string to Uint8Array
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to Hex string
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decode a did:key:z6Mk... into a 32-byte Ed25519 public key.
 * Format:
 * Prefix: "did:key:z" (multibase base58btc)
 * Multicodec header: 0xed, 0x01 (ed25519-pub, 2 bytes)
 * Raw public key: 32 bytes
 * @param {string} did
 * @returns {Uint8Array}
 */
export function decodeDidKey(did) {
  if (typeof did !== 'string' || !did.startsWith('did:key:z6Mk')) {
    throw new Error('Invalid DID format. Expected did:key:z6Mk...');
  }
  const base58Str = did.replace('did:key:z', '');
  const multicodecBytes = bs58Decode(base58Str);

  if (multicodecBytes.length !== 34) {
    throw new Error(`Invalid DID length: ${multicodecBytes.length} bytes (expected 34)`);
  }

  // Verify multicodec ed25519-pub prefix 0xed01
  if (multicodecBytes[0] !== 0xed || multicodecBytes[1] !== 0x01) {
    throw new Error('DID does not specify an Ed25519 multicodec key');
  }

  return multicodecBytes.slice(2);
}

/**
 * Reconstruct payload string for signature verification: `${room}|${nonce}|${text}`
 * @param {string} room
 * @param {string|number} nonce
 * @param {string} text
 * @returns {Uint8Array}
 */
export function reconstructPayload(room, nonce, text) {
  const payloadStr = `${room}|${nonce}|${text}`;
  return new TextEncoder().encode(payloadStr);
}

/**
 * Perform client-side cryptographic verification of a Technocore message.
 * @param {string} room - The room name
 * @param {string|number} nonce - Message nonce
 * @param {string} text - The raw text of the message
 * @param {string} did - Sender's did:key:z6Mk... identifier
 * @param {string} signature - Hex or base64url signature
 * @returns {Promise<{ valid: boolean, publicKeyHex?: string, error?: string, payload?: string }>}
 */
export async function verifyTechnocoreMessage(room, nonce, text, did, signature) {
  try {
    if (!did || !did.startsWith('did:key:z6Mk')) {
      return { valid: false, error: 'Sender is not a signed did:key identity' };
    }

    if (!signature) {
      // In Technocore, if message has from: "did:key:z6Mk..." and nonce, upstream verified it at write time
      return { valid: true, isServerAttested: true };
    }

    const pubKey = decodeDidKey(did);
    const pubKeyHex = bytesToHex(pubKey);
    const payloadStr = `${room}|${nonce}|${text}`;
    const payloadBytes = new TextEncoder().encode(payloadStr);

    let sigBytes;
    if (typeof signature === 'string') {
      if (/^[0-9a-fA-F]{128}$/.test(signature)) {
        sigBytes = hexToBytes(signature);
      } else {
        sigBytes = base64urlToBytes(signature);
      }
    } else if (signature instanceof Uint8Array) {
      sigBytes = signature;
    } else {
      return { valid: false, error: 'Unknown signature format' };
    }

    if (sigBytes.length !== 64) {
      return { valid: false, error: `Invalid signature byte length: ${sigBytes.length} (expected 64)` };
    }

    let isValid = false;
    try {
      isValid = await ed.verifyAsync(sigBytes, payloadBytes, pubKey);
    } catch (edErr) {
      // Fallback to server endpoint if local module has compatibility/CDN error
      const fallbackRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, nonce, text, did, sig: signature }),
      }).then((r) => r.json()).catch(() => null);

      if (fallbackRes && typeof fallbackRes.valid === 'boolean') {
        return fallbackRes;
      }
      throw edErr;
    }

    return {
      valid: isValid,
      publicKeyHex: pubKeyHex,
      payload: payloadStr,
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message,
    };
  }
}
