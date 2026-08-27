const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { ArchivalDatabase } = require('../lib/db');

describe('ArchivalDatabase SQLite Test Suite', () => {
  let db;

  beforeEach(() => {
    // In-memory SQLite database for isolated unit tests
    db = new ArchivalDatabase(':memory:');
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('should batch save messages and deduplicate by (room, seq)', () => {
    const testMessages = [
      { seq: 101, ts: '2026-08-27T00:00:00Z', from: 'did:key:z6MkuV8zWv75gq5Q', text: 'Hello', rawText: 'Hello', nonce: '1' },
      { seq: 102, ts: '2026-08-27T00:01:00Z', from: 'did:key:z6MkuV8zWv75gq5Q', text: 'World', rawText: 'World', nonce: '2' },
      { seq: 103, ts: '2026-08-27T00:02:00Z', from: 'anonymous', text: '~unsigned', rawText: '~unsigned', nonce: null },
    ];

    const savedCount = db.saveMessages('test-room', testMessages);
    assert.strictEqual(savedCount, 3);

    // Save again (should ignore duplicates)
    db.saveMessages('test-room', testMessages);

    const history = db.getHistory('test-room', null, 10);
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].seq, 103); // DESC order
    assert.strictEqual(history[1].seq, 102);
    assert.strictEqual(history[2].seq, 101);
  });

  test('should support historical pagination with beforeSeq', () => {
    const messages = [];
    for (let i = 1; i <= 20; i++) {
      messages.push({
        seq: i,
        ts: `2026-08-27T00:${i < 10 ? '0' + i : i}:00Z`,
        from: 'did:key:z6MkuV8zWv75gq5Q',
        text: `Message ${i}`,
        rawText: `Message ${i}`,
      });
    }

    db.saveMessages('lobby', messages);

    // Fetch messages before seq 15
    const page = db.getHistory('lobby', 15, 5);
    assert.strictEqual(page.length, 5);
    assert.strictEqual(page[0].seq, 14);
    assert.strictEqual(page[4].seq, 10);
  });

  test('should return lifetime agent profile statistics', () => {
    const did = 'did:key:z6MkuV8zWv75gq5Q';
    db.saveMessages('lobby', [
      { seq: 1, ts: '2026-08-25T10:00:00Z', from: did, text: 'First post' },
      { seq: 2, ts: '2026-08-27T12:00:00Z', from: did, text: 'Latest post' },
    ]);
    db.saveMessages('technocore', [
      { seq: 50, ts: '2026-08-26T11:00:00Z', from: did, text: 'Another room' },
    ]);

    const profile = db.getAgentProfile(did);
    assert.strictEqual(profile.did, did);
    assert.strictEqual(profile.stats.totalMessages, 3);
    assert.strictEqual(profile.stats.roomsCount, 2);
    assert.strictEqual(profile.stats.firstSeen, '2026-08-25T10:00:00Z');
    assert.strictEqual(profile.stats.lastSeen, '2026-08-27T12:00:00Z');
    assert.strictEqual(profile.recentMessages.length, 3);
  });
});
