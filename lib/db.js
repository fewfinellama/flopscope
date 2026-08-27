/**
 * Persistent Archival Database for Flopscope.
 * Uses native node:sqlite (DatabaseSync) on Node.js 22.5+ / 24+ with WAL mode,
 * with an automatic fallback adapter on Node.js 20.x for universal CI/CD compatibility.
 */
const path = require('path');
const fs = require('fs');

let NodeSqliteDatabase = null;
try {
  const sqlite = require('node:sqlite');
  if (sqlite && typeof sqlite.DatabaseSync === 'function') {
    NodeSqliteDatabase = sqlite.DatabaseSync;
  }
} catch (e) {
  // node:sqlite is not available (e.g. Node < 22.5)
}

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

    if (NodeSqliteDatabase) {
      this.mode = 'sqlite';
      this.db = new NodeSqliteDatabase(this.dbPath);
      this.initSqliteSchema();
    } else {
      this.mode = 'memory-store';
      this.messages = []; // In-memory store fallback
      this.messagesMap = new Map(); // Key: `${room}:${seq}`
    }
  }

  initSqliteSchema() {
    try {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA cache_size = 10000;');
    } catch (e) {
      // Ignore on memory db
    }

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

  saveMessages(room, messages) {
    if (!room || !Array.isArray(messages) || messages.length === 0) return 0;
    const now = Date.now();
    let saved = 0;

    if (this.mode === 'sqlite') {
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

    // Memory Store Fallback
    for (const msg of messages) {
      if (msg && msg.seq !== undefined) {
        const key = `${room}:${msg.seq}`;
        if (!this.messagesMap.has(key)) {
          const item = {
            room,
            seq: parseInt(msg.seq, 10) || 0,
            ts: msg.ts || '',
            from: msg.from || '',
            text: msg.text || '',
            rawText: msg.rawText || msg.text || '',
            nonce: msg.nonce !== undefined && msg.nonce !== null ? String(msg.nonce) : null,
            sig: msg.sig || null,
            isSigned: msg.from && msg.from.startsWith('did:key:z6Mk') ? 1 : 0,
            created_at: now,
          };
          this.messagesMap.set(key, item);
          this.messages.push(item);
          saved++;
        }
      }
    }
    return saved;
  }

  getHistory(room, beforeSeq = null, limit = 50) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    if (this.mode === 'sqlite') {
      if (beforeSeq !== null && !Number.isNaN(parseInt(beforeSeq, 10))) {
        return this.getHistoryStmt.all(room, parseInt(beforeSeq, 10), safeLimit);
      }
      return this.getLatestHistoryStmt.all(room, safeLimit);
    }

    // Memory Store Fallback
    let filtered = this.messages.filter((m) => m.room === room);
    if (beforeSeq !== null && !Number.isNaN(parseInt(beforeSeq, 10))) {
      filtered = filtered.filter((m) => m.seq < parseInt(beforeSeq, 10));
    }
    filtered.sort((a, b) => b.seq - a.seq);
    return filtered.slice(0, safeLimit);
  }

  getAgentProfile(did, limit = 50) {
    if (!did) return null;
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    if (this.mode === 'sqlite') {
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

    // Memory Store Fallback
    const agentMessages = this.messages.filter((m) => m.from === did);
    const rooms = new Set(agentMessages.map((m) => m.room));
    const timestamps = agentMessages.map((m) => m.ts).filter(Boolean).sort();

    agentMessages.sort((a, b) => b.created_at - a.created_at);

    return {
      did,
      stats: {
        totalMessages: agentMessages.length,
        roomsCount: rooms.size,
        firstSeen: timestamps[0] || null,
        lastSeen: timestamps[timestamps.length - 1] || null,
      },
      recentMessages: agentMessages.slice(0, safeLimit),
    };
  }

  close() {
    if (this.mode === 'sqlite' && this.db) {
      try {
        this.db.close();
      } catch (e) {}
    }
  }
}

module.exports = {
  ArchivalDatabase,
};
