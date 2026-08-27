/**
 * Input validation and sanitization helpers for Technocore Explorer.
 * Prevents XSS, SSRF, injection attacks, and malicious payloads.
 */

const ROOM_NAME_REGEX = /^[a-zA-Z0-9_-]{1,48}$/;
const DID_KEY_REGEX = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;

/**
 * Validate room name string.
 * @param {string} name
 * @returns {boolean}
 */
function isValidRoomName(name) {
  if (typeof name !== 'string') return false;
  return ROOM_NAME_REGEX.test(name);
}

/**
 * Validate DID key format.
 * @param {string} did
 * @returns {boolean}
 */
function isValidDidKey(did) {
  if (typeof did !== 'string') return false;
  return DID_KEY_REGEX.test(did);
}

/**
 * Validate sequence number or query offset.
 * @param {any} val
 * @returns {number|null}
 */
function parseSequenceNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = parseInt(val, 10);
  if (Number.isNaN(num) || num < 0 || !Number.isSafeInteger(num)) {
    return null;
  }
  return num;
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize a message object before serving it downstream.
 * @param {object} msg
 * @returns {object}
 */
function sanitizeMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;

  return {
    seq: typeof msg.seq === 'number' ? msg.seq : parseInt(msg.seq, 10) || 0,
    ts: typeof msg.ts === 'string' ? escapeHtml(msg.ts) : String(msg.ts || ''),
    from: typeof msg.from === 'string' ? escapeHtml(msg.from) : '',
    text: typeof msg.text === 'string' ? escapeHtml(msg.text) : '',
    rawText: typeof msg.text === 'string' ? msg.text : '',
    nonce: msg.nonce !== undefined ? String(msg.nonce) : null,
    sig: typeof msg.sig === 'string' ? msg.sig : null,
    isSigned: typeof msg.from === 'string' && msg.from.startsWith('did:key:z6Mk'),
  };
}

module.exports = {
  isValidRoomName,
  isValidDidKey,
  parseSequenceNumber,
  escapeHtml,
  sanitizeMessage,
  ROOM_NAME_REGEX,
  DID_KEY_REGEX,
};
