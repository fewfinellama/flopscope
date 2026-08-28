const test = require('node:test');
const assert = require('node:assert');

test('health-scorer.js — Room Health Scoring (v1)', async (t) => {
  const { computeRoomHealth } = await import('../public/js/health-scorer.js');

  // Helper: build a minimal message
  const msg = (text, from = 'did:key:z6MkAnon', seq = 1) => ({ text, rawText: text, from, seq });

  // ─── Empty / edge cases ──────────────────────────────────────────
  await t.test('returns zeroed metrics for empty message array', () => {
    const result = computeRoomHealth('lobby', []);
    assert.strictEqual(result.healthScore, 0);
    assert.strictEqual(result.sampleSize, 0);
    assert.strictEqual(result.room, 'lobby');
  });

  await t.test('returns zeroed metrics for null input', () => {
    const result = computeRoomHealth('lobby', null);
    assert.strictEqual(result.healthScore, 0);
  });

  // ─── Score shape ─────────────────────────────────────────────────
  await t.test('output has all required fields', () => {
    const result = computeRoomHealth('test', [msg('hello world this is a real message')]);
    assert.ok('room' in result);
    assert.ok('healthScore' in result);
    assert.ok('spamShare' in result);
    assert.ok('signalShare' in result);
    assert.ok('authorConcentration' in result);
    assert.ok('reciprocity' in result);
    assert.ok('uniquePersistentDids' in result);
    assert.ok('uniqueDids' in result);
    assert.ok('breakdown' in result);
    assert.ok('sampleSize' in result);
  });

  await t.test('healthScore is clamped 0–100', () => {
    // All boilerplate: low score
    const spam = Array.from({ length: 20 }, (_, i) => msg('gm', `did:key:z6Mk${i}`, i));
    const lowResult = computeRoomHealth('lobby', spam);
    assert.ok(lowResult.healthScore >= 0 && lowResult.healthScore <= 100, `score out of range: ${lowResult.healthScore}`);

    // All high-signal: high score
    const signal = Array.from({ length: 20 }, (_, i) =>
      msg(`Here is a detailed technical analysis of the Technocore protocol proof system including base58 encoding and Ed25519 verification steps https://github.com/example`, `did:key:z6Mk${i}`, i)
    );
    const highResult = computeRoomHealth('lobby', signal);
    assert.ok(highResult.healthScore >= 0 && highResult.healthScore <= 100, `score out of range: ${highResult.healthScore}`);
  });

  // ─── spamShare correctness ────────────────────────────────────────
  await t.test('all boilerplate messages produce high spamShare', () => {
    const messages = [msg('gm'), msg('gm'), msg('gm'), msg('gm')];
    const result = computeRoomHealth('lobby', messages);
    assert.ok(result.spamShare >= 0.9, `expected high spamShare, got ${result.spamShare}`);
  });

  await t.test('high-signal messages produce low spamShare', () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      msg('This is a detailed technical contribution to the ATTEST protocol with external links https://example.com', `did:key:z6Mk${i}`, i)
    );
    const result = computeRoomHealth('lobby', messages);
    assert.strictEqual(result.spamShare, 0);
  });

  // ─── authorConcentration (HHI) ───────────────────────────────────
  await t.test('single author produces maximum concentration (HHI = 1)', () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      msg('gm', 'did:key:z6MkSingleAuthor', i)
    );
    const result = computeRoomHealth('lobby', messages);
    assert.strictEqual(result.authorConcentration, 1);
  });

  await t.test('many unique authors produce low concentration', () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      msg('gm', `did:key:z6Mk${i}`, i)
    );
    const result = computeRoomHealth('lobby', messages);
    assert.ok(result.authorConcentration < 0.1, `expected low HHI, got ${result.authorConcentration}`);
  });

  // ─── Breakdown transparency ───────────────────────────────────────
  await t.test('breakdown fields are numbers and sum is sane', () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      msg('A message with https://github.com/example a URL', `did:key:z6Mk${i}`, i)
    );
    const { breakdown } = computeRoomHealth('lobby', messages);
    assert.ok(typeof breakdown.spamPenalty === 'number');
    assert.ok(typeof breakdown.signalBonus === 'number');
    assert.ok(typeof breakdown.concentrationPenalty === 'number');
    assert.ok(typeof breakdown.reciprocityBonus === 'number');
    assert.ok(typeof breakdown.persistenceBonus === 'number');
  });

  // ─── Persistent DIDs ─────────────────────────────────────────────
  await t.test('DIDs with >= 2 messages count as persistent', () => {
    const messages = [
      msg('first message', 'did:key:z6MkAlice', 1),
      msg('second message', 'did:key:z6MkAlice', 2),
      msg('only message', 'did:key:z6MkBob', 3),
    ];
    const result = computeRoomHealth('lobby', messages);
    assert.strictEqual(result.uniquePersistentDids, 1); // Only Alice qualifies
    assert.strictEqual(result.uniqueDids, 2);
  });
});
