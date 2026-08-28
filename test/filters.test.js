const test = require('node:test');
const assert = require('node:assert');

test('filters.js — Usefulness Filters', async (t) => {
  const { applyUsefulnessFilter, extractUrls, hasCodeOrJson, hasProtocol } =
    await import('../public/js/filters.js');

  // Helper: make a minimal message object
  const msg = (text) => ({ rawText: text, text, seq: 1 });

  // ─── extractUrls ───────────────────────────────────────────────
  await t.test('extractUrls: finds http and https URLs', () => {
    const urls = extractUrls('Check out https://github.com/foo and http://example.com for more');
    assert.strictEqual(urls.length, 2);
    assert.ok(urls[0].startsWith('https://github.com/foo'));
  });

  await t.test('extractUrls: returns empty array for no URLs', () => {
    assert.deepStrictEqual(extractUrls('just some plain text'), []);
    assert.deepStrictEqual(extractUrls(''), []);
    assert.deepStrictEqual(extractUrls(null), []);
  });

  // ─── hasCodeOrJson ─────────────────────────────────────────────
  await t.test('hasCodeOrJson: detects fenced code blocks', () => {
    assert.strictEqual(hasCodeOrJson('Here is code:\n```js\nconsole.log("hi")\n```'), true);
  });

  await t.test('hasCodeOrJson: detects inline code', () => {
    assert.strictEqual(hasCodeOrJson('Run `npm install` first'), true);
  });

  await t.test('hasCodeOrJson: detects JSON-shaped content', () => {
    assert.strictEqual(hasCodeOrJson('payload: {"type": "ATTEST"}'), true);
  });

  await t.test('hasCodeOrJson: rejects plain prose', () => {
    assert.strictEqual(hasCodeOrJson('gm everyone, checking in'), false);
    assert.strictEqual(hasCodeOrJson(''), false);
  });

  // ─── hasProtocol ───────────────────────────────────────────────
  await t.test('hasProtocol: detects ATTEST v1', () => {
    assert.strictEqual(hasProtocol('ATTEST v1 | task-123 | useful | rh:abc | great work'), true);
  });

  await t.test('hasProtocol: detects DELIVER v1', () => {
    assert.strictEqual(hasProtocol('DELIVER v1 | task-456 | submitted'), true);
  });

  await t.test('hasProtocol: rejects non-protocol messages', () => {
    assert.strictEqual(hasProtocol('gm'), false);
    assert.strictEqual(hasProtocol('Check out https://example.com'), false);
  });

  // ─── applyUsefulnessFilter ─────────────────────────────────────
  await t.test('mode=all: returns all messages unfiltered', () => {
    const messages = [msg('gm'), msg('hello'), msg('ATTEST v1 | t1 | useful | rh:x | ok')];
    assert.strictEqual(applyUsefulnessFilter(messages, 'all').length, 3);
    assert.strictEqual(applyUsefulnessFilter(messages, null).length, 3);
  });

  await t.test('mode=high-signal: filters out boilerplate', () => {
    const messages = [msg('gm'), msg('gn'), msg('Here is a detailed analysis of the proof system')];
    const result = applyUsefulnessFilter(messages, 'high-signal');
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].rawText.includes('detailed analysis'));
  });

  await t.test('mode=has-url: only returns messages with URLs', () => {
    const messages = [msg('gm'), msg('see https://example.com'), msg('another plain message')];
    const result = applyUsefulnessFilter(messages, 'has-url');
    assert.strictEqual(result.length, 1);
  });

  await t.test('mode=has-code: only returns messages with code or JSON', () => {
    const messages = [msg('gm'), msg('run `npm test` to verify'), msg('plain text only')];
    const result = applyUsefulnessFilter(messages, 'has-code');
    assert.strictEqual(result.length, 1);
  });

  await t.test('mode=protocol: only returns ATTEST/DELIVER messages', () => {
    const messages = [
      msg('gm'),
      msg('ATTEST v1 | task-1 | useful | rh:hash | comment'),
      msg('DELIVER v1 | task-2 | done'),
      msg('random message'),
    ];
    const result = applyUsefulnessFilter(messages, 'protocol');
    assert.strictEqual(result.length, 2);
  });

  await t.test('does not mutate original array', () => {
    const messages = [msg('gm'), msg('hello world from agent')];
    const original = [...messages];
    applyUsefulnessFilter(messages, 'high-signal');
    assert.strictEqual(messages.length, original.length);
  });
});
