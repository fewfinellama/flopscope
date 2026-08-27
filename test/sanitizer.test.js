const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  isValidRoomName,
  isValidDidKey,
  parseSequenceNumber,
  escapeHtml,
  sanitizeMessage,
} = require('../lib/sanitizer');

describe('Sanitizer & Validator Test Suite', () => {
  describe('isValidRoomName', () => {
    test('should allow valid room names', () => {
      assert.strictEqual(isValidRoomName('lobby'), true);
      assert.strictEqual(isValidRoomName('technocore'), true);
      assert.strictEqual(isValidRoomName('d-my-room_123'), true);
      assert.strictEqual(isValidRoomName('mb-agent-inbox'), true);
      assert.strictEqual(isValidRoomName('p-abcdef123456'), true);
    });

    test('should reject invalid room names and path traversal attempts', () => {
      assert.strictEqual(isValidRoomName(''), false);
      assert.strictEqual(isValidRoomName('../secret'), false);
      assert.strictEqual(isValidRoomName('room/name'), false);
      assert.strictEqual(isValidRoomName('room name'), false);
      assert.strictEqual(isValidRoomName('room<script>'), false);
      assert.strictEqual(isValidRoomName('a'.repeat(50)), false); // too long
      assert.strictEqual(isValidRoomName(null), false);
    });
  });

  describe('isValidDidKey', () => {
    test('should validate correct Ed25519 did:key format', () => {
      const validDid = 'did:key:z6Mkq56G2oU3hK3uQ98a97k2Lq98a97k2Lq98a97k2Lq98a9'; // 56 chars
      assert.strictEqual(isValidDidKey(validDid), true);
    });

    test('should reject invalid DID formats', () => {
      assert.strictEqual(isValidDidKey('did:ion:12345'), false);
      assert.strictEqual(isValidDidKey('did:key:z8Mk...'), false);
      assert.strictEqual(isValidDidKey('did:key:z6MkShort'), false);
      assert.strictEqual(isValidDidKey(''), false);
    });
  });

  describe('parseSequenceNumber', () => {
    test('should parse valid sequence integers', () => {
      assert.strictEqual(parseSequenceNumber('0'), 0);
      assert.strictEqual(parseSequenceNumber('142'), 142);
      assert.strictEqual(parseSequenceNumber(500), 500);
    });

    test('should return null for invalid sequence values', () => {
      assert.strictEqual(parseSequenceNumber('-1'), null);
      assert.strictEqual(parseSequenceNumber('abc'), null);
      assert.strictEqual(parseSequenceNumber(null), null);
      assert.strictEqual(parseSequenceNumber(''), null);
    });
  });

  describe('escapeHtml', () => {
    test('should escape dangerous HTML characters to prevent XSS', () => {
      const raw = '<script>alert("xss")</script> & \'test\'';
      const escaped = escapeHtml(raw);
      assert.strictEqual(
        escaped,
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#039;test&#039;'
      );
    });

    test('should handle empty or non-string values gracefully', () => {
      assert.strictEqual(escapeHtml(''), '');
      assert.strictEqual(escapeHtml(null), '');
    });
  });

  describe('sanitizeMessage', () => {
    test('should sanitize message fields and preserve rawText', () => {
      const input = {
        seq: '100',
        ts: '2026-08-27T00:00:00Z',
        from: 'did:key:z6Mkq<script>',
        text: 'Hello <b>world</b>',
        nonce: 12345,
      };

      const result = sanitizeMessage(input);
      assert.strictEqual(result.seq, 100);
      assert.strictEqual(result.from, 'did:key:z6Mkq&lt;script&gt;');
      assert.strictEqual(result.text, 'Hello &lt;b&gt;world&lt;/b&gt;');
      assert.strictEqual(result.rawText, 'Hello <b>world</b>');
      assert.strictEqual(result.nonce, '12345');
    });
  });
});
