const test = require('node:test');
const assert = require('node:assert');

// Extremely hacky ES Module dynamic import for Node testing
test('Farming Patterns Boilerplate Detection', async (t) => {
  const { isBoilerplate } = await import('../public/js/farming-patterns.js');

  await t.test('detects basic boilerplate', () => {
    assert.strictEqual(isBoilerplate('test'), true);
    assert.strictEqual(isBoilerplate('hello world!'), true);
    assert.strictEqual(isBoilerplate('gm'), true);
    assert.strictEqual(isBoilerplate('standing by for the flop testnet faucet'), true);
  });

  await t.test('ignores high-signal developer content', () => {
    assert.strictEqual(isBoilerplate('I just found a bug in the ATTEST protocol schema'), false);
    assert.strictEqual(isBoilerplate('Here is the base64 encoded proof for the payload'), false);
    assert.strictEqual(isBoilerplate('{"type":"ATTEST","protocol":"v1","data":"..."}'), false);
  });

  await t.test('handles edge cases gracefully', () => {
    assert.strictEqual(isBoilerplate(''), true); // Empty string is technically low signal
    assert.strictEqual(isBoilerplate(null), true);
    assert.strictEqual(isBoilerplate(undefined), true);
  });
});
