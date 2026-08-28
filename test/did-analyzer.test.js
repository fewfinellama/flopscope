const test = require('node:test');
const assert = require('node:assert');

test('did-analyzer.js — DID Quality & Sybil Radar', async (t) => {
  // did-analyzer reads from/writes to state.didStats — we must mock state
  // We do this by importing store and resetting it between tests
  const storeModule = await import('../public/js/store.js');
  const { analyzeDids, DID_ANALYZER_VERSION } = await import('../public/js/did-analyzer.js');

  // Helper: reset state between tests
  const resetState = () => {
    storeModule.state.didStats = new Map();
  };

  const msg = (text, from, seq = 1) => ({ text, rawText: text, from, seq });

  // ─── Version export ───────────────────────────────────────────────
  await t.test('exports a version string', () => {
    assert.ok(typeof DID_ANALYZER_VERSION === 'string');
    assert.ok(DID_ANALYZER_VERSION.length > 0);
  });

  // ─── Basic tracking ───────────────────────────────────────────────
  await t.test('tracks a did:key DID after processing a message', () => {
    resetState();
    const messages = [msg('hello world this is a real message', 'did:key:z6MkAlice', 1)];
    analyzeDids('lobby', messages);
    assert.ok(storeModule.state.didStats.has('did:key:z6MkAlice'));
  });

  await t.test('ignores messages from unsigned senders (no did:key prefix)', () => {
    resetState();
    const messages = [msg('hello', '~nick', 1), msg('world', null, 2)];
    analyzeDids('lobby', messages);
    assert.strictEqual(storeModule.state.didStats.size, 0);
  });

  await t.test('increments messageCount on repeated messages from same DID', () => {
    resetState();
    const messages = [
      msg('message one', 'did:key:z6MkAlice', 1),
      msg('message two', 'did:key:z6MkAlice', 2),
      msg('message three', 'did:key:z6MkAlice', 3),
    ];
    analyzeDids('lobby', messages);
    const stats = storeModule.state.didStats.get('did:key:z6MkAlice');
    assert.strictEqual(stats.messageCount, 3);
  });

  await t.test('tracks rooms a DID has visited', () => {
    resetState();
    analyzeDids('lobby', [msg('hi', 'did:key:z6MkAlice', 1)]);
    analyzeDids('technocore', [msg('hi again', 'did:key:z6MkAlice', 2)]);
    const stats = storeModule.state.didStats.get('did:key:z6MkAlice');
    assert.ok(stats.rooms.has('lobby'));
    assert.ok(stats.rooms.has('technocore'));
  });

  // ─── Originality scoring ──────────────────────────────────────────
  await t.test('originality score decreases for boilerplate messages', () => {
    resetState();
    // Send multiple boilerplate messages
    const messages = Array.from({ length: 5 }, (_, i) => msg('gm', 'did:key:z6MkSpammer', i));
    analyzeDids('lobby', messages);
    const stats = storeModule.state.didStats.get('did:key:z6MkSpammer');
    assert.ok(stats.originalityScore < 1.0, `Expected lower score, got ${stats.originalityScore}`);
  });

  await t.test('originality score stays high for substantive messages', () => {
    resetState();
    const messages = [
      msg('This is a very detailed technical contribution about ATTEST protocol verification and proof of useful intelligence', 'did:key:z6MkDev', 1),
      msg('Here is the follow-up with a URL https://github.com/example containing further evidence', 'did:key:z6MkDev', 2),
    ];
    analyzeDids('lobby', messages);
    const stats = storeModule.state.didStats.get('did:key:z6MkDev');
    assert.ok(stats.originalityScore >= 1.0, `Expected high originality, got ${stats.originalityScore}`);
  });

  // ─── Flag derivation ──────────────────────────────────────────────
  await t.test('flags template-heavy DID after many boilerplate messages', () => {
    resetState();
    const messages = Array.from({ length: 6 }, (_, i) => msg('gm', 'did:key:z6MkSpammer', i));
    analyzeDids('lobby', messages);
    const stats = storeModule.state.didStats.get('did:key:z6MkSpammer');
    assert.ok(stats.flags.has('template-heavy'), `Expected template-heavy flag, got: ${[...stats.flags].join(', ')}`);
  });

  await t.test('flags high-reciprocity DID when they receive 3+ mentions', () => {
    resetState();
    // First establish Alice
    analyzeDids('lobby', [msg('hello', 'did:key:z6MkAlice', 1)]);
    // Now 3 other DIDs mention Alice
    analyzeDids('lobby', [
      msg('reply to did:key:z6MkAlice great work', 'did:key:z6MkBob', 2),
      msg('agree with did:key:z6MkAlice completely', 'did:key:z6MkCarol', 3),
      msg('did:key:z6MkAlice you are right about this', 'did:key:z6MkDave', 4),
    ]);
    const stats = storeModule.state.didStats.get('did:key:z6MkAlice');
    assert.ok(stats.flags.has('high-reciprocity'), `Expected high-reciprocity flag, got: ${[...stats.flags].join(', ')}`);
  });

  await t.test('uses neutral language in flags — no moral judgments', () => {
    resetState();
    const messages = Array.from({ length: 6 }, (_, i) => msg('gm', 'did:key:z6MkSpammer', i));
    analyzeDids('lobby', messages);
    const stats = storeModule.state.didStats.get('did:key:z6MkSpammer');
    const forbiddenWords = ['bad', 'evil', 'malicious', 'spam', 'bot'];
    for (const flag of stats.flags) {
      for (const word of forbiddenWords) {
        assert.ok(!flag.includes(word), `Flag "${flag}" contains judgmental language: "${word}"`);
      }
    }
  });

  // ─── LRU eviction ─────────────────────────────────────────────────
  await t.test('does not mutate original messages array', () => {
    resetState();
    const messages = [msg('hello', 'did:key:z6MkAlice', 1)];
    const original = [...messages];
    analyzeDids('lobby', messages);
    assert.strictEqual(messages.length, original.length);
  });
});
