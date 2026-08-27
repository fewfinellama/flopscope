const { test, describe } = require('node:test');
const assert = require('node:assert');
const { MemoryCache } = require('../lib/cache');

describe('MemoryCache Test Suite', () => {
  test('should store and retrieve data within TTL', () => {
    const cache = new MemoryCache(5000);
    cache.set('test-key', { message: 'hello' });

    assert.strictEqual(cache.has('test-key'), true);
    const entry = cache.get('test-key');
    assert.ok(entry);
    assert.strictEqual(entry.data.message, 'hello');
    assert.ok(entry.ageMs >= 0);
    cache.destroy();
  });

  test('should return null and miss count for expired items', async () => {
    const cache = new MemoryCache(50); // 50ms TTL
    cache.set('quick-key', { val: 123 });

    // Wait 70ms for expiration
    await new Promise((resolve) => setTimeout(resolve, 70));

    const entry = cache.get('quick-key');
    assert.strictEqual(entry, null);
    assert.strictEqual(cache.has('quick-key'), false);

    const stats = cache.stats();
    assert.strictEqual(stats.misses, 1);
    cache.destroy();
  });

  test('should track hits, misses, and hit rate percent', () => {
    const cache = new MemoryCache(5000);
    cache.set('k1', 'data1');

    cache.get('k1'); // hit
    cache.get('k1'); // hit
    cache.get('missing'); // miss

    const stats = cache.stats();
    assert.strictEqual(stats.hits, 2);
    assert.strictEqual(stats.misses, 1);
    assert.strictEqual(stats.hitRatePercent, 66.67);
    cache.destroy();
  });

  test('should delete and clear entries properly', () => {
    const cache = new MemoryCache(5000);
    cache.set('k1', 'val1');
    cache.set('k2', 'val2');

    assert.strictEqual(cache.delete('k1'), true);
    assert.strictEqual(cache.has('k1'), false);
    assert.strictEqual(cache.has('k2'), true);

    cache.clear();
    assert.strictEqual(cache.has('k2'), false);
    assert.strictEqual(cache.stats().itemCount, 0);
    cache.destroy();
  });
});
