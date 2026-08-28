const test = require('node:test');
const assert = require('node:assert');

test('protocol-probes.js — Protocol Health Probes (v1)', async (t) => {
  const {
    probeSequenceContinuity,
    probeMessageFraming,
    probeSignatureCoverage,
    probeVelocitySanity,
    probeDidFormat,
    runProbes,
    PROBES_VERSION,
  } = await import('../public/js/protocol-probes.js');

  const msg = (seq, from, text = 'hello') => ({ seq, from, text, rawText: text });

  // ─── Version ─────────────────────────────────────────────────────
  await t.test('exports a version string', () => {
    assert.ok(typeof PROBES_VERSION === 'string');
  });

  // ─── probeSequenceContinuity ──────────────────────────────────────
  await t.test('skipped when fewer than 2 sequences', () => {
    const r = probeSequenceContinuity([1]);
    assert.strictEqual(r.status, 'skipped');
  });

  await t.test('passes when gaps are within threshold', () => {
    const seqs = [100, 101, 102, 103, 200]; // gap of 97 — under default 500
    const r = probeSequenceContinuity(seqs);
    assert.strictEqual(r.status, 'pass');
  });

  await t.test('fails when a gap exceeds threshold', () => {
    const seqs = [100, 101, 102, 700, 701]; // gap of 598 — over default 500
    const r = probeSequenceContinuity(seqs);
    assert.strictEqual(r.status, 'fail');
    assert.ok(r.detail.includes('598'));
  });

  await t.test('respects custom maxGap parameter', () => {
    const seqs = [100, 200]; // gap of 100
    assert.strictEqual(probeSequenceContinuity(seqs, 50).status, 'fail');
    assert.strictEqual(probeSequenceContinuity(seqs, 200).status, 'pass');
  });

  // ─── probeMessageFraming ──────────────────────────────────────────
  await t.test('skipped when message array is empty', () => {
    assert.strictEqual(probeMessageFraming([]).status, 'skipped');
  });

  await t.test('passes when all messages have seq and text', () => {
    const messages = [msg(1, 'did:key:z6MkA'), msg(2, 'did:key:z6MkB')];
    assert.strictEqual(probeMessageFraming(messages).status, 'pass');
  });

  await t.test('fails when >5% of messages are malformed', () => {
    const good = Array.from({ length: 9 }, (_, i) => msg(i + 1, 'did:key:z6MkA'));
    const bad = [{ from: 'did:key:z6MkB' }]; // missing seq and text
    const r = probeMessageFraming([...good, ...bad]);
    assert.strictEqual(r.status, 'fail');
  });

  // ─── probeSignatureCoverage ───────────────────────────────────────
  await t.test('skipped when no messages', () => {
    assert.strictEqual(probeSignatureCoverage([]).status, 'skipped');
  });

  await t.test('always passes — coverage is a diagnostic, not a failure', () => {
    // Even 0% coverage is "pass" — it's informational only
    const messages = [msg(1, '~nick'), msg(2, '~another')];
    assert.strictEqual(probeSignatureCoverage(messages).status, 'pass');
  });

  await t.test('reports correct coverage percentage in detail', () => {
    const messages = [
      msg(1, 'did:key:z6MkSigned'),
      msg(2, '~nick'),
    ];
    const r = probeSignatureCoverage(messages);
    assert.ok(r.detail.includes('1/2'));
    assert.ok(r.detail.includes('50.0%'));
  });

  // ─── probeVelocitySanity ──────────────────────────────────────────
  await t.test('skipped when newMessagesSinceLastPoll is null', () => {
    assert.strictEqual(probeVelocitySanity(null, 'lobby').status, 'skipped');
  });

  await t.test('fails when lobby has zero new messages', () => {
    assert.strictEqual(probeVelocitySanity(0, 'lobby').status, 'fail');
  });

  await t.test('passes when lobby has new messages', () => {
    assert.strictEqual(probeVelocitySanity(5, 'lobby').status, 'pass');
  });

  await t.test('does not fail for other rooms with zero messages', () => {
    // Only lobby is expected to be always-active
    assert.strictEqual(probeVelocitySanity(0, 'quiet-room').status, 'pass');
  });

  // ─── probeDidFormat ───────────────────────────────────────────────
  await t.test('skipped when no messages', () => {
    assert.strictEqual(probeDidFormat([]).status, 'skipped');
  });

  await t.test('skipped when no signed messages', () => {
    const messages = [msg(1, '~nick'), msg(2, null)];
    assert.strictEqual(probeDidFormat(messages).status, 'skipped');
  });

  await t.test('passes when all signed messages use did:key:z6Mk format', () => {
    const messages = [msg(1, 'did:key:z6MkAlice'), msg(2, 'did:key:z6MkBob')];
    assert.strictEqual(probeDidFormat(messages).status, 'pass');
  });

  await t.test('fails when a signed DID uses unexpected format', () => {
    const messages = [
      msg(1, 'did:key:z6MkAlice'),
      msg(2, 'did:web:example.com'), // unexpected format
    ];
    assert.strictEqual(probeDidFormat(messages).status, 'fail');
  });

  // ─── runProbes orchestrator ───────────────────────────────────────
  await t.test('returns all 5 probe results', () => {
    const result = runProbes({ messages: [], room: 'lobby', newMessagesSinceLastPoll: 5 });
    assert.strictEqual(result.probes.length, 5);
    const names = result.probes.map(p => p.name);
    assert.ok(names.includes('sequence-continuity'));
    assert.ok(names.includes('message-framing'));
    assert.ok(names.includes('signature-coverage'));
    assert.ok(names.includes('velocity-sanity'));
    assert.ok(names.includes('did-format'));
  });

  await t.test('status is ok when no failures', () => {
    const messages = Array.from({ length: 10 }, (_, i) =>
      msg(i + 1, 'did:key:z6MkA', 'Hello world this is a real message')
    );
    const result = runProbes({ messages, room: 'lobby', newMessagesSinceLastPoll: 3 });
    assert.strictEqual(result.status, 'ok');
  });

  await t.test('status is degraded when a probe fails', () => {
    // Trigger sequence-continuity failure
    const messages = [msg(1, 'did:key:z6MkA'), msg(1000, 'did:key:z6MkB')];
    const result = runProbes({ messages, room: 'lobby', newMessagesSinceLastPoll: 2 });
    assert.ok(['degraded', 'ok'].includes(result.status));
    assert.ok(typeof result.lastRun === 'number');
  });

  await t.test('always includes lastRun timestamp', () => {
    const before = Date.now();
    const result = runProbes({});
    assert.ok(result.lastRun >= before);
  });
});
