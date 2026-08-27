/**
 * Cryptographic verification service and Base58 / Ed25519 utilities.
 */
const ed = require('@noble/ed25519');

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP = {};
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET.charAt(i)] = i;
}

/**
 * Decode a Base58btc string into a Uint8Array.
 * @param {string} string
 * @returns {Uint8Array}
 */
function bs58Decode(string) {
  if (typeof string !== 'string' || string.length === 0) return new Uint8Array(0);
  const bytes = [0];
  for (let i = 0; i < string.length; i++) {
    const char = string[i];
    const value = BASE58_MAP[char];
    if (value === undefined) {
      throw new Error(`Invalid base58 character: "${char}"`);
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
 * Encode a Uint8Array or byte array into Base58btc string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bs58Encode(bytes) {
  if (!bytes || bytes.length === 0) return '';
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let string = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    string += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    string += BASE58_ALPHABET[digits[i]];
  }
  return string;
}

/**
 * Convert Base64 or Base64URL string to Uint8Array.
 * @param {string} b64url
 * @returns {Uint8Array}
 */
function base64urlToBytes(b64url) {
  if (typeof b64url !== 'string') throw new Error('Expected base64url string');
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const buf = Buffer.from(b64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
}

/**
 * Convert Hex string to Uint8Array.
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
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
 * Convert Uint8Array to Hex string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
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
function decodeDidKey(did) {
  if (typeof did !== 'string' || !did.startsWith('did:key:z6Mk')) {
    throw new Error('Invalid DID format. Expected did:key:z6Mk...');
  }
  const base58Str = did.replace('did:key:z', '');
  const multicodecBytes = bs58Decode(base58Str);

  // Check length: 2 header bytes + 32 key bytes = 34 bytes
  if (multicodecBytes.length !== 34) {
    throw new Error(`Unexpected decoded DID key byte length: ${multicodecBytes.length}, expected 34`);
  }

  // Check multicodec header 0xed, 0x01
  if (multicodecBytes[0] !== 0xed || multicodecBytes[1] !== 0x01) {
    throw new Error(`Invalid multicodec prefix: 0x${multicodecBytes[0].toString(16)}, 0x${multicodecBytes[1].toString(16)}`);
  }

  return multicodecBytes.slice(2);
}

/**
 * Convert a 32-byte Ed25519 public key into a did:key:z6Mk... string.
 * @param {Uint8Array} pubKeyBytes
 * @returns {string}
 */
function encodeDidKey(pubKeyBytes) {
  if (!pubKeyBytes || pubKeyBytes.length !== 32) {
    throw new Error('Public key must be exactly 32 bytes');
  }
  const multicodec = new Uint8Array(34);
  multicodec[0] = 0xed;
  multicodec[1] = 0x01;
  multicodec.set(pubKeyBytes, 2);
  return 'did:key:z' + bs58Encode(multicodec);
}

/**
 * Reconstruct payload string for signature verification.
 * Format: `${room}|${nonce}|${text}`
 * @param {string} room
 * @param {string|number} nonce
 * @param {string} text
 * @returns {Uint8Array} UTF-8 encoded bytes
 */
function reconstructPayloadBytes(room, nonce, text) {
  const payloadStr = `${room}|${nonce}|${text}`;
  return new TextEncoder().encode(payloadStr);
}

/**
 * Verify an Ed25519 signature against room, nonce, text, and DID.
 * Accepts signature as hex string, base64url string, or Uint8Array.
 * @param {string} room
 * @param {string|number} nonce
 * @param {string} text
 * @param {string} did
 * @param {string|Uint8Array} signature
 * @returns {Promise<boolean>}
 */
async function verifyTechnocoreSignature(room, nonce, text, did, signature) {
  try {
    if (!did || !did.startsWith('did:key:z6Mk')) return false;
    if (!signature || !nonce) return false;

    const pubKey = decodeDidKey(did);
    const payloadBytes = reconstructPayloadBytes(room, nonce, text);

    let sigBytes;
    if (signature instanceof Uint8Array) {
      sigBytes = signature;
    } else if (typeof signature === 'string') {
      if (/^[0-9a-fA-F]{128}$/.test(signature)) {
        sigBytes = hexToBytes(signature);
      } else {
        sigBytes = base64urlToBytes(signature);
      }
    } else {
      return false;
    }

    if (sigBytes.length !== 64) {
      return false;
    }

    return await ed.verifyAsync(sigBytes, payloadBytes, pubKey);
  } catch (err) {
    return false;
  }
}

module.exports = {
  bs58Decode,
  bs58Encode,
  base64urlToBytes,
  hexToBytes,
  bytesToHex,
  decodeDidKey,
  encodeDidKey,
  reconstructPayloadBytes,
  verifyTechnocoreSignature,
};
