const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const ed = require('@noble/ed25519');
const app = require('../server');
const { encodeDidKey, reconstructPayloadBytes } = require('../lib/crypto-service');

const getRandomKey = () => (ed.utils.randomPrivateKey ? ed.utils.randomPrivateKey() : require('crypto').randomBytes(32));

let server;
let baseUrl;

describe('Express Server API Integration Tests', () => {
  before((t, done) => {
    // Listen on ephemeral random port (port 0)
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  after((t, done) => {
    server.close(done);
  });

  test('GET /api/health should return ok status and metrics', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, 'ok');
    assert.strictEqual(json.service, 'technocore-explorer');
    assert.ok(json.cache);
  });

  test('GET /api/rooms should respond with active rooms list', async () => {
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(`${baseUrl}/api/rooms`);
      if (res.status === 200) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
    assert.strictEqual(typeof json.count, 'number');
    assert.strictEqual(typeof json.cached, 'boolean');
  });

  test('GET /api/rooms/lobby should return room feed data', async () => {
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(`${baseUrl}/api/rooms/lobby`);
      if (res.status === 200) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.room, 'lobby');
    assert.ok(Array.isArray(json.data));
    assert.strictEqual(typeof json.count, 'number');
  });

  test('GET /api/rooms/invalid..name should reject with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/rooms/invalid..name!`);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.statusCode, 400);
    assert.ok(json.error.includes('Invalid room name'));
  });

  test('POST /api/verify should validate valid cryptographic signature', async () => {
    const privKey = getRandomKey();
    const pubKey = await ed.getPublicKeyAsync(privKey);
    const did = encodeDidKey(pubKey);

    const room = 'technocore';
    const nonce = '1787803853542';
    const text = 'Verified message test';

    const payloadBytes = reconstructPayloadBytes(room, nonce, text);
    const sigBytes = await ed.signAsync(payloadBytes, privKey);
    const sigB64Url = Buffer.from(sigBytes).toString('base64url');

    const res = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, nonce, text, did, sig: sigB64Url }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.valid, true);
    assert.strictEqual(json.did, did);
    assert.strictEqual(json.reconstructedPayload, `${room}|${nonce}|${text}`);
  });

  test('POST /api/verify should return false for invalid signature', async () => {
    const privKey = getRandomKey();
    const pubKey = await ed.getPublicKeyAsync(privKey);
    const did = encodeDidKey(pubKey);

    const room = 'technocore';
    const nonce = '1787803853542';
    const text = 'Authentic message';
    const forgedSig = Buffer.alloc(64).toString('base64url');

    const res = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, nonce, text, did, sig: forgedSig }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.valid, false);
  });

  test('Security Headers: Content-Security-Policy should be present', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp);
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes('https://cdn.tailwindcss.com'));
  });
});
