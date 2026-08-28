/**
 * Usefulness Filters — filters.js
 * Version: 1.0.0
 *
 * Pure client-side filtering of already-loaded NormalizedMessage objects.
 * No network calls. No DOM side-effects. No state mutations.
 *
 * Modes:
 *   'all'         — No filter applied. Show everything.
 *   'high-signal' — Hide messages matching known boilerplate patterns.
 *   'has-url'     — Only show messages containing at least one HTTP(S) URL.
 *   'has-code'    — Only show messages containing a code block or JSON snippet.
 *   'protocol'    — Only show messages using ATTEST / DELIVER structured protocol.
 *
 * Formula (v1): A message passes "high-signal" when:
 *   isBoilerplate(text) === false AND text.trim().length >= 12
 */

import { isBoilerplate } from './farming-patterns.js';

export const FILTERS_VERSION = '1.0.0';

// Matches http:// or https:// URLs
const URL_REGEX = /https?:\/\/[^\s"'<>)\]]+/gi;

// Matches fenced code blocks or inline code
const CODE_BLOCK_REGEX = /```[\s\S]*?```|`[^`\n]{2,}`/;

// Matches JSON-ish objects or arrays with at least one key-value pair
const JSON_REGEX = /[{[]\s*"[^"]+"\s*:/;

// Matches ATTEST or DELIVER v1 protocol headers
const PROTOCOL_REGEX = /^(ATTEST|DELIVER)\s+v\d+\s*\|/i;

/**
 * Extract all URLs found in a message's raw text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  if (!text || typeof text !== 'string') return [];
  return Array.from(text.matchAll(URL_REGEX), (m) => m[0]);
}

/**
 * Returns true if the message text contains a code block or JSON snippet.
 * @param {string} text
 * @returns {boolean}
 */
export function hasCodeOrJson(text) {
  if (!text || typeof text !== 'string') return false;
  return CODE_BLOCK_REGEX.test(text) || JSON_REGEX.test(text);
}

/**
 * Returns true if the message uses a structured protocol (ATTEST / DELIVER).
 * @param {string} text
 * @returns {boolean}
 */
export function hasProtocol(text) {
  if (!text || typeof text !== 'string') return false;
  return PROTOCOL_REGEX.test(text.trim());
}

/**
 * Apply the active usefulness filter to a list of already-fetched messages.
 * Pure function — does not mutate the input array.
 *
 * @param {object[]} messages - NormalizedMessage objects from state.messages
 * @param {'all'|'high-signal'|'has-url'|'has-code'|'protocol'} mode
 * @returns {object[]} Filtered array
 */
export function applyUsefulnessFilter(messages, mode) {
  if (!mode || mode === 'all') return messages;

  return messages.filter((msg) => {
    const text = msg.rawText || msg.text || '';

    switch (mode) {
      case 'high-signal':
        return !isBoilerplate(text) && text.trim().length >= 12;
      case 'has-url':
        return extractUrls(text).length > 0;
      case 'has-code':
        return hasCodeOrJson(text);
      case 'protocol':
        return hasProtocol(text);
      default:
        return true;
    }
  });
}
