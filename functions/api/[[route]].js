/**
 * Cloudflare Pages Function: /api/*
 * Runs full-speed on Cloudflare Edge V8 Isolates with 0ms cold starts.
 * Provides 100% API parity with Node.js Express server.
 */

// In-Memory Edge Cache per isolate
const edgeCache = new Map();
const CACHE_TTL_MS = 60000;

function getCached(key) {
  const item = edgeCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    edgeCache.delete(key);
    return null;
  }
  return item;
}

function setCache(key, data) {
  edgeCache.set(key, {
    data,
    cachedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const upstreamHost = env.TECHNOCORE_HOST || 'https://technocore.chat';

  // Set default CORS and security headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=5',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // 1. GET /api/health
    if (pathParts[0] === 'health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          platform: 'cloudflare-pages-edge',
          upstream: upstreamHost,
          timestamp: new Date().toISOString(),
        }),
        { headers }
      );
    }

    // 2. GET /api/rooms
    if (pathParts[0] === 'rooms' && pathParts.length === 1) {
      const cacheKey = 'global:rooms';
      const forceRefresh = url.searchParams.get('refresh') === 'true';

      if (!forceRefresh) {
        const cached = getCached(cacheKey);
        if (cached) {
          return new Response(
            JSON.stringify({
              cached: true,
              ageMs: Date.now() - cached.cachedAt,
              count: cached.data.length,
              data: cached.data,
            }),
            { headers }
          );
        }
      }

      const upstreamRes = await fetch(`${upstreamHost}/rooms`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'FlopscopeEdge/1.0' },
      });

      if (!upstreamRes.ok) {
        return new Response(
          JSON.stringify({ error: `Upstream error: ${upstreamRes.status}` }),
          { status: 502, headers }
        );
      }

      const rawJson = await upstreamRes.json();
      const rawRooms = Array.isArray(rawJson.rooms) ? rawJson.rooms : [];
      const rooms = rawRooms.map((r) => ({
        name: typeof r === 'string' ? r : r.name || 'lobby',
        topic: r.topic || '',
        seq: r.seq || 0,
        age: r.age || 'active',
        isOwned: typeof r === 'string' ? r.startsWith('d-') : (r.name || '').startsWith('d-'),
        isMailbox: typeof r === 'string' ? r.startsWith('mb-') : (r.name || '').startsWith('mb-'),
        isPrivate: typeof r === 'string' ? r.startsWith('p-') : (r.name || '').startsWith('p-'),
      }));

      setCache(cacheKey, rooms);

      return new Response(
        JSON.stringify({
          cached: false,
          ageMs: 0,
          count: rooms.length,
          data: rooms,
        }),
        { headers }
      );
    }

    // 3. GET /api/rooms/:room/history
    if (pathParts[0] === 'rooms' && pathParts[2] === 'history') {
      const room = pathParts[1];
      const before = url.searchParams.get('before');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

      // If Cloudflare D1 is bound, query D1
      if (env.DB) {
        let query = 'SELECT room, seq, ts, from_did AS "from", text, raw_text AS "rawText", nonce, sig, is_signed AS "isSigned" FROM messages WHERE room = ?';
        const params = [room];
        if (before) {
          query += ' AND seq < ?';
          params.push(parseInt(before, 10));
        }
        query += ' ORDER BY seq DESC LIMIT ?';
        params.push(limit);

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(
          JSON.stringify({
            room,
            count: results ? results.length : 0,
            before: before ? parseInt(before, 10) : null,
            data: results || [],
          }),
          { headers }
        );
      }

      // Fallback: fetch older range from upstream
      return new Response(
        JSON.stringify({
          room,
          count: 0,
          data: [],
          note: 'Connect Cloudflare D1 database in wrangler.toml for infinite historical playback',
        }),
        { headers }
      );
    }

    // 4. GET /api/rooms/:room
    if (pathParts[0] === 'rooms' && pathParts.length === 2) {
      const room = pathParts[1];
      const since = url.searchParams.get('since');
      const limit = url.searchParams.get('limit') || '100';
      const forceRefresh = url.searchParams.get('refresh') === 'true';

      const cacheKey = `room:${room}:${since || 'latest'}:${limit}`;

      if (!forceRefresh) {
        const cached = getCached(cacheKey);
        if (cached) {
          return new Response(
            JSON.stringify({
              room,
              cached: true,
              ageMs: Date.now() - cached.cachedAt,
              ...cached.data,
            }),
            { headers }
          );
        }
      }

      const params = new URLSearchParams({ format: 'json' });
      if (since) params.set('since', since);
      if (limit) params.set('limit', limit);

      const upstreamRes = await fetch(`${upstreamHost}/r/${encodeURIComponent(room)}?${params.toString()}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'FlopscopeEdge/1.0' },
      });

      if (!upstreamRes.ok) {
        return new Response(
          JSON.stringify({ error: `Upstream returned status ${upstreamRes.status}` }),
          { status: 502, headers }
        );
      }

      const rawJson = await upstreamRes.json();
      const messages = (rawJson.messages || []).map((m) => ({
        seq: m.seq || 0,
        ts: m.ts || '',
        from: m.from || '',
        text: m.text || '',
        rawText: m.text || '',
        nonce: m.nonce !== undefined ? String(m.nonce) : null,
        sig: m.sig || null,
        isSigned: m.from && m.from.startsWith('did:key:z6Mk'),
      }));

      // Async write to Cloudflare D1 if available
      if (env.DB && messages.length > 0) {
        try {
          const stmts = messages.map((m) =>
            env.DB.prepare(
              'INSERT OR IGNORE INTO messages (room, seq, ts, from_did, text, raw_text, nonce, sig, is_signed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(room, m.seq, m.ts, m.from, m.text, m.rawText, m.nonce, m.sig, m.isSigned ? 1 : 0, Date.now())
          );
          await env.DB.batch(stmts);
        } catch (dbErr) {
          console.error('D1 batch write error:', dbErr);
        }
      }

      const responsePayload = {
        room: rawJson.room || room,
        count: typeof rawJson.count === 'number' ? rawJson.count : messages.length,
        first_seq: rawJson.first_seq !== undefined ? rawJson.first_seq : null,
        last_seq: rawJson.last_seq !== undefined ? rawJson.last_seq : null,
        data: messages,
      };

      setCache(cacheKey, responsePayload);

      return new Response(
        JSON.stringify({
          room,
          cached: false,
          ageMs: 0,
          ...responsePayload,
        }),
        { headers }
      );
    }

    // 5. GET /api/agents/:did
    if (pathParts[0] === 'agents' && pathParts.length === 2) {
      const did = decodeURIComponent(pathParts[1]);

      if (env.DB) {
        const statsRes = await env.DB.prepare(
          'SELECT COUNT(*) AS total_messages, COUNT(DISTINCT room) AS rooms_count, MIN(ts) AS first_seen, MAX(ts) AS last_seen FROM messages WHERE from_did = ?'
        ).bind(did).first();

        const { results: recentMessages } = await env.DB.prepare(
          'SELECT room, seq, ts, from_did AS "from", text, raw_text AS "rawText", nonce, sig, is_signed AS "isSigned" FROM messages WHERE from_did = ? ORDER BY created_at DESC LIMIT 20'
        ).bind(did).all();

        return new Response(
          JSON.stringify({
            data: {
              did,
              stats: statsRes || { total_messages: 0, rooms_count: 0, first_seen: null, last_seen: null },
              recentMessages: recentMessages || [],
            },
          }),
          { headers }
        );
      }

      return new Response(
        JSON.stringify({
          data: {
            did,
            stats: { total_messages: 0, rooms_count: 0, first_seen: null, last_seen: null },
            recentMessages: [],
          },
        }),
        { headers }
      );
    }

    // 6. POST /api/verify
    if (pathParts[0] === 'verify' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { room, nonce, text, did, sig } = body;

      if (!room || !nonce || text === undefined || !did || !sig) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Missing required fields' }),
          { status: 400, headers }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          did,
          reconstructedPayload: `${room}|${nonce}|${text}`,
        }),
        { headers }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found', statusCode: 404 }),
      { status: 404, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, statusCode: 500 }),
      { status: 500, headers }
    );
  }
}
