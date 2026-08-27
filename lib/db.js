/**
 * Persistent SQLite Archival Database for Flopscope.
 * Uses native node:sqlite with WAL mode for ultra-fast, zero-lock concurrent queries.
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

class ArchivalDatabase {
  constructor(dbPath = null) {
    if (!dbPath) {
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = path.join(dataDir, 'flopscope.db');
    } else {
      this.dbPath = dbPath;
    }

    this.db = new DatabaseSync(this.dbPath);
    this.initSchema();
  }

  initSchema() {
    // Enable WAL mode and performance optimizations
    try {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA cache_size = 10000;');
    } catch (e) {
      // Memory or restricted DB fallback
    }

    // Schema: messages table with compound primary key (room, seq)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        room TEXT NOT NULL,
        seq INTEGER NOT NULL,
        ts TEXT,
        from_did TEXT,
        text TEXT,
        raw_text TEXT,
        nonce TEXT,
        sig TEXT,
        is_signed INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (room, seq)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_room_seq ON messages (room, seq DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_did ON messages (from_did);
    `);

    // Prepare reusable statements
    this.insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO messages (
        room, seq, ts, from_did, text, raw_text, nonce, sig, is_signed, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    this.getHistoryStmt = this.db.prepare(`
      SELECT 
        room, seq, ts, from_did AS "from", text, raw_text AS "rawText", nonce, sig, is_signed AS "isSigned"
      FROM messages
      WHERE room = ? AND seq < ?
      ORDER BY seq DESC
      LIMIT ?
    `);

    this.getLatestHistoryStmt = this.db.prepare(`
      SELECT 
        room, seq, ts, from_did AS "from", text, raw_text AS "rawText", nonce, sig, is_signed AS "isSigned"
      FROM messages
      WHERE room = ?
      ORDER BY seq DESC
      LIMIT ?
    `);

    this.getAgentMessagesStmt = this.db.prepare(`
      SELECT 
        room, seq, ts, from_did AS "from", text, raw_text AS "rawText", nonce, sig, is_signed AS "isSigned"
      FROM messages
      WHERE from_did = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    this.getAgentStatsStmt = this.db.prepare(`
      SELECT 
        COUNT(*) AS total_messages,
        COUNT(DISTINCT room) AS rooms_count,
        MIN(ts) AS first_seen,
        MAX(ts) AS last_seen
      FROM messages
      WHERE from_did = ?
    `);
  }

  /**
   * Batch save messages to the archive.
   * @param {string} room
   * @param {Array<object>} messages
   * @returns {number} Number of items processed
   */
  saveMessages(room, messages) {
    if (!room || !Array.isArray(messages) || messages.length === 0) return 0;

    const now = Date.now();
    let saved = 0;

    this.db.exec('BEGIN TRANSACTION;');
    try {
      for (const msg of messages) {
        if (msg && msg.seq !== undefined) {
          const isSigned = msg.from && msg.from.startsWith('did:key:z6Mk') ? 1 : 0;
          this.insertStmt.run(
            room,
            parseInt(msg.seq, 10) || 0,
            msg.ts || '',
            msg.from || '',
            msg.text || '',
            msg.rawText || msg.text || '',
            msg.nonce !== undefined && msg.nonce !== null ? String(msg.nonce) : null,
            msg.sig || null,
            isSigned,
            now
          );
          saved++;
        }
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      console.error('Error saving messages to SQLite archive:', err);
    }

    return saved;
  }

  /**
   * Fetch historical messages older than a given sequence number.
   * @param {string} room
   * @param {number|null} beforeSeq
   * @param {number} limit
   * @returns {Array<object>}
   */
  getHistory(room, beforeSeq = null, limit = 50) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    if (beforeSeq !== null && !Number.isNaN(parseInt(beforeSeq, 10))) {
      return this.getHistoryStmt.all(room, parseInt(beforeSeq, 10), safeLimit);
    }

    return this.getLatestHistoryStmt.all(room, safeLimit);
  }

  /**
   * Fetch lifetime stats and message history for an agent DID.
   * @param {string} did
   * @param {number} limit
   * @returns {object}
   */
  getAgentProfile(did, limit = 50) {
    if (!did) return null;

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const stats = this.getAgentStatsStmt.get(did) || {
      total_messages: 0,
      rooms_count: 0,
      first_seen: null,
      last_seen: null,
    };

    const messages = this.getAgentMessagesStmt.all(did, safeLimit);

    return {
      did,
      stats: {
        totalMessages: stats.total_messages || 0,
        roomsCount: stats.rooms_count || 0,
        firstSeen: stats.first_seen,
        lastSeen: stats.last_seen,
      },
      recentMessages: messages,
    };
  }

  /**
   * Close the database connection.
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = {
  ArchivalDatabase,
};
