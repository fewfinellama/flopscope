-- Cloudflare D1 Database Schema for Flopscope
-- Compound Primary Key (room, seq) guarantees deduplication and high-speed historical indexed lookups

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
