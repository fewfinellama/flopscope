const { test, describe } = require('node:test');
const assert = require('node:assert');
const ed = require('@noble/ed25519');
const {
  bs58Decode,
  bs58Encode,
  base64urlToBytes,
  hexToBytes,
  bytesToHex,
  decodeDidKey,
  encodeDidKey,
  reconstructPayloadBytes,
  verifyTechnocoreSignature,
} = require('../lib/crypto-service');

const getRandomKey = () => (ed.utils.randomPrivateKey ? ed.utils.randomPrivateKey() : require('crypto').randomBytes(32));

describe('Cryptographic Verification Test Suite', () => {
  describe('Base58 Encoding & Decoding', () => {
    test('should roundtrip byte arrays correctly', () => {
      const originalBytes = new Uint8Array([0, 1, 2, 3, 255, 128, 64, 0, 0, 42]);
      const encoded = bs58Encode(originalBytes);
      const decoded = bs58Decode(encoded);
      assert.deepStrictEqual(decoded, originalBytes);
    });

    test('should throw on invalid base58 characters', () => {
      assert.throws(() => bs58Decode('0OIl'), /Invalid base58 character/);
    });
  });

  describe('DID Key Encoding & Decoding', () => {
    test('should encode and decode 32-byte Ed25519 public key to did:key:z6Mk...', async () => {
      const privKey = getRandomKey();
      const pubKey = await ed.getPublicKeyAsync(privKey);

      const did = encodeDidKey(pubKey);
      assert.ok(did.startsWith('did:key:z6Mk'));
      assert.strictEqual(did.length, 56);

      const decodedPubKey = decodeDidKey(did);
      assert.deepStrictEqual(decodedPubKey, pubKey);
    });

    test('should reject malformed DID prefixes or invalid multicodec headers', () => {
      assert.throws(() => decodeDidKey('did:ion:12345'), /Invalid DID format/);
    });
  });

  describe('Technocore Ed25519 Signature Verification', () => {
    test('should verify valid signature with hex and base64url encodings', async () => {
      const privKey = getRandomKey();
      const pubKey = await ed.getPublicKeyAsync(privKey);
      const did = encodeDidKey(pubKey);

      const room = 'technocore';
      const nonce = '1787803853542';
      const text = 'Agent node reporting in. Ed25519 identity verified.';

      const payloadBytes = reconstructPayloadBytes(room, nonce, text);
      const sigBytes = await ed.signAsync(payloadBytes, privKey);

      const sigHex = bytesToHex(sigBytes);
      const sigB64Url = Buffer.from(sigBytes).toString('base64url');

      // Test with hex signature
      const validHex = await verifyTechnocoreSignature(room, nonce, text, did, sigHex);
      assert.strictEqual(validHex, true);

      // Test with base64url signature
      const validB64 = await verifyTechnocoreSignature(room, nonce, text, did, sigB64Url);
      assert.strictEqual(validB64, true);

      // Test with raw Uint8Array signature
      const validRaw = await verifyTechnocoreSignature(room, nonce, text, did, sigBytes);
      assert.strictEqual(validRaw, true);
    });

    test('should fail verification if text is tampered with', async () => {
      const privKey = getRandomKey();
      const pubKey = await ed.getPublicKeyAsync(privKey);
      const did = encodeDidKey(pubKey);

      const room = 'technocore';
      const nonce = '1787803853542';
      const originalText = 'Legitimate message text';
      const tamperedText = 'Attacker modified message text';

      const payloadBytes = reconstructPayloadBytes(room, nonce, originalText);
      const sigBytes = await ed.signAsync(payloadBytes, privKey);
      const sigB64Url = Buffer.from(sigBytes).toString('base64url');

      const isTamperedValid = await verifyTechnocoreSignature(
        room,
        nonce,
        tamperedText,
        did,
        sigB64Url
      );
      assert.strictEqual(isTamperedValid, false);
    });

    test('should fail verification if nonce or room is mismatched', async () => {
      const privKey = getRandomKey();
      const pubKey = await ed.getPublicKeyAsync(privKey);
      const did = encodeDidKey(pubKey);

      const room = 'technocore';
      const nonce = '1000';
      const text = 'Test';

      const payloadBytes = reconstructPayloadBytes(room, nonce, text);
      const sigBytes = await ed.signAsync(payloadBytes, privKey);
      const sigB64Url = Buffer.from(sigBytes).toString('base64url');

      // Different room
      const wrongRoom = await verifyTechnocoreSignature('lobby', nonce, text, did, sigB64Url);
      assert.strictEqual(wrongRoom, false);

      // Different nonce
      const wrongNonce = await verifyTechnocoreSignature(room, '1001', text, did, sigB64Url);
      assert.strictEqual(wrongNonce, false);
    });
  });
});
