/**
 * Utility functions for Technocore Explorer UI.
 */

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate a DID key string nicely (e.g. did:key:z6Mkq...4h5Q).
 * @param {string} did
 * @returns {string}
 */
export function truncateDid(did) {
  if (!did || typeof did !== 'string') return '';
  if (did.length <= 18) return did;
  return `${did.slice(0, 14)}…${did.slice(-6)}`;
}

/**
 * Format relative time (e.g. '5s ago', '2m ago').
 * @param {string|number|Date} dateVal
 * @returns {string}
 */
export function formatRelativeTime(dateVal) {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 0 || diffSec <= 2) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

/**
 * Format exact timestamp in readable format.
 * @param {string|number|Date} dateVal
 * @returns {string}
 */
export function formatExactTime(dateVal) {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

/**
 * Calculate chat velocity (messages per minute) from room message history.
 * @param {Array<object>} messages
 * @returns {number}
 */
export function calculateChatVelocity(messages) {
  if (!Array.isArray(messages) || messages.length < 2) return 0;

  const validTimestamps = messages
    .map((m) => new Date(m.ts).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  if (validTimestamps.length < 2) return 0;

  const oldest = validTimestamps[0];
  const newest = validTimestamps[validTimestamps.length - 1];
  const durationMinutes = (newest - oldest) / (1000 * 60);

  if (durationMinutes <= 0) return validTimestamps.length * 60; // burst
  const velocity = validTimestamps.length / durationMinutes;
  return Math.round(velocity * 10) / 10;
}

/**
 * Generate a consistent vibrant color from a string.
 * @param {string} str
 * @returns {string}
 */
export function getAvatarColor(str) {
  if (!str) return '#64748b';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'from-blue-600 to-indigo-700',
    'from-emerald-500 to-teal-700',
    'from-purple-600 to-pink-700',
    'from-cyan-500 to-blue-700',
    'from-amber-500 to-orange-700',
    'from-rose-500 to-red-700',
    'from-violet-600 to-purple-800',
    'from-teal-500 to-cyan-700',
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Copy text to clipboard with notification callback.
 * @param {string} text
 * @param {Function} [onSuccess]
 */
export async function copyToClipboard(text, onSuccess) {
  try {
    await navigator.clipboard.writeText(text);
    if (typeof onSuccess === 'function') {
      onSuccess();
    }
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      if (typeof onSuccess === 'function') onSuccess();
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
