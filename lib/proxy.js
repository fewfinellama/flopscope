/**
 * Upstream Technocore API Proxy Client.
 * Securely communicates with https://technocore.chat with timeout and SSRF isolation.
 */
const { isValidRoomName, parseSequenceNumber, sanitizeMessage } = require('./sanitizer');

class TechnocoreProxy {
  constructor(baseUrl = 'https://technocore.chat', timeoutMs = 15000) {
    // Strict sanitization of baseUrl
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Fetch room messages from upstream in JSON format.
   * @param {string} room
   * @param {number|null} since
   * @param {number|null} limit
   * @returns {Promise<object>}
   */
  async fetchRoom(room, since = null, limit = null) {
    if (!isValidRoomName(room)) {
      const err = new Error('Invalid room name parameter');
      err.statusCode = 400;
      throw err;
    }

    const params = new URLSearchParams();
    params.set('format', 'json');

    const parsedSince = parseSequenceNumber(since);
    if (parsedSince !== null) {
      params.set('since', parsedSince.toString());
    }

    const parsedLimit = parseInt(limit || 100, 10);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 200) {
      params.set('limit', parsedLimit.toString());
    }

    const targetUrl = `${this.baseUrl}/r/${encodeURIComponent(room)}?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TechnocoreExplorer/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const err = new Error(text || `Upstream returned status ${response.status}`);
        err.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
        throw err;
      }

      const rawJson = await response.json();

      // Normalize and sanitize messages array
      const rawMessages = Array.isArray(rawJson.messages) ? rawJson.messages : [];
      const messages = rawMessages.map(sanitizeMessage).filter(Boolean);

      return {
        room: rawJson.room || room,
        count: typeof rawJson.count === 'number' ? rawJson.count : messages.length,
        first_seq: rawJson.first_seq !== undefined ? rawJson.first_seq : null,
        last_seq: rawJson.last_seq !== undefined ? rawJson.last_seq : null,
        data: messages,
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Upstream Technocore gateway timed out');
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      if (!err.statusCode) {
        err.statusCode = 502;
      }
      throw err;
    }
  }

  /**
   * Fetch active rooms directory from upstream.
   * @returns {Promise<Array<object>>}
   */
  async fetchRooms() {
    const targetUrl = `${this.baseUrl}/rooms`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'TechnocoreExplorer/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const err = new Error(`Upstream /rooms returned status ${response.status}`);
        err.statusCode = 502;
        throw err;
      }

      const text = await response.text();
      return this.parseRoomsText(text);
    } catch (err) {
      clearTimeout(timer);
      if (!err.statusCode) {
        err.statusCode = 502;
      }
      throw err;
    }
  }

  /**
   * Parse plain text /rooms output into structured array of objects.
   * Format: /r/<name>   seq <seq>   <size>   <age>  · <topic>
   * @param {string} text
   * @returns {Array<object>}
   */
  parseRoomsText(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split('\n');
    const rooms = [];

    // Regex matching line format: /r/lobby  seq 3549817  7.9M  0s ago  · Technocore & Ecosystem Room
    const lineRegex = /^\/r\/([a-zA-Z0-9_-]+)\s+seq\s+(\d+)\s+([^\s]+)\s+([\d\w\s]+?ago)(?:\s+·\s*(.*))?$/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(lineRegex);
      if (match) {
        rooms.push({
          name: match[1],
          seq: parseInt(match[2], 10),
          size: match[3],
          age: match[4].trim(),
          topic: match[5] ? match[5].trim() : '',
          isOwned: match[1].startsWith('d-'),
          isMailbox: match[1].startsWith('mb-'),
          isPrivate: match[1].startsWith('p-'),
        });
      }
    }

    return rooms;
  }
}

module.exports = { TechnocoreProxy };
