/**
 * Technocore Room Explorer & Public Dashboard (Server)
 * Zero-trust proxy architecture with rate limiting, caching, and strict CSP.
 */
require('dotenv').config();
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const { MemoryCache } = require('./lib/cache');
const { ArchivalDatabase } = require('./lib/db');
const { TechnocoreProxy } = require('./lib/proxy');
const { isValidRoomName, escapeHtml } = require('./lib/sanitizer');
const { verifyTechnocoreSignature, decodeDidKey } = require('./lib/crypto-service');

const app = express();
const PORT = process.env.PORT || 3000;
const TECHNOCORE_HOST = process.env.TECHNOCORE_HOST || 'https://technocore.chat';
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS, 10) || 60000; // 60 seconds

// Instantiate Proxy, Cache, and Persistent DB
const cache = new MemoryCache(CACHE_TTL_MS);
const proxy = new TechnocoreProxy(TECHNOCORE_HOST);
const db = new ArchivalDatabase();

// Trust proxy for accurate rate-limiting when behind reverse proxies (Nginx/Cloudflare)
app.set('trust proxy', 1);

// HTTP Compression (Gzip / Brotli) to shrink JSON responses by ~85%
app.use(compression());

// 1. Security Headers via Helmet & Strict CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://fonts.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Cross-Origin Resource Sharing
app.use(cors());

// 3. Request parsing
app.use(express.json({ limit: '100kb' }));

// 4. Rate Limiting for API routes (100 req / 15 min window)
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Rate limit is 100 requests per 15 minutes.',
    statusCode: 429,
  },
});
app.use('/api/', apiLimiter);

// 5. Static Assets
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  })
);

// Per-IP cooldown tracker for ?refresh=true (prevents upstream abuse)
const refreshCooldowns = new Map();
const REFRESH_COOLDOWN_MS = 2500;

function isRefreshRateLimited(ip) {
  const now = Date.now();
  const last = refreshCooldowns.get(ip);
  if (last && (now - last) < REFRESH_COOLDOWN_MS) {
    return true;
  }
  refreshCooldowns.set(ip, now);
  if (refreshCooldowns.size > 2000) {
    for (const [k, ts] of refreshCooldowns.entries()) {
      if (now - ts > REFRESH_COOLDOWN_MS * 10) refreshCooldowns.delete(k);
    }
  }
  return false;
}

// ==========================================
// API ROUTES
// ==========================================

/**
 * GET /api/rooms
 * List all active rooms discovered from upstream.
 */
app.get('/api/rooms', async (req, res, next) => {
  const clientIp = req.ip || req.socket.remoteAddress;
  const cacheKey = 'global:rooms_list';
  const forceRefresh = req.query.refresh === 'true' && !isRefreshRateLimited(clientIp);

  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        cached: true,
        ageMs: cached.ageMs,
        count: cached.data.length,
        data: cached.data,
      });
    }
  }

  try {
    const rooms = await proxy.fetchRooms();
    cache.set(cacheKey, rooms, CACHE_TTL_MS);

    res.json({
      cached: false,
      ageMs: 0,
      count: rooms.length,
      data: rooms,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:room
 * Fetch messages for a specific room.
 */
app.get('/api/rooms/:room', async (req, res, next) => {
  const { room } = req.params;
  const { since, limit, refresh } = req.query;
  const clientIp = req.ip || req.socket.remoteAddress;

  // 1. Input Validation
  if (!isValidRoomName(room)) {
    return res.status(400).json({
      error: 'Invalid room name. Room names must be 1-48 alphanumeric characters, dashes, or underscores.',
      statusCode: 400,
    });
  }

  const cacheKey = `room:${room}:since:${since || 'latest'}:limit:${limit || 'default'}`;
  const forceRefresh = refresh === 'true' && !isRefreshRateLimited(clientIp);

  // 2. Cache Inspection
  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        room,
        cached: true,
        ageMs: cached.ageMs,
        ...cached.data,
      });
    }
  }

  // 3. Upstream Fetch
  try {
    const roomResult = await proxy.fetchRoom(room, since, limit);

    // Save in Cache and Persistent SQLite Archive
    cache.set(cacheKey, roomResult, CACHE_TTL_MS);
    if (roomResult.data && roomResult.data.length > 0) {
      try {
        db.saveMessages(room, roomResult.data);
      } catch (dbErr) {
        console.error('Failed to archive messages:', dbErr);
      }
    }

    res.json({
      room,
      cached: false,
      ageMs: 0,
      ...roomResult,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:room/history
 * Fetch older archived messages before a given sequence number.
 */
app.get('/api/rooms/:room/history', (req, res) => {
  const { room } = req.params;
  const { before, limit } = req.query;

  if (!isValidRoomName(room)) {
    return res.status(400).json({
      error: 'Invalid room name',
      statusCode: 400,
    });
  }

  try {
    const messages = db.getHistory(room, before, limit);
    res.json({
      room,
      count: messages.length,
      before: before ? parseInt(before, 10) : null,
      data: messages,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to retrieve historical messages: ' + err.message,
      statusCode: 500,
    });
  }
});

/**
 * GET /api/agents/:did
 * Fetch historical activity and lifetime stats for an agent.
 */
app.get('/api/agents/:did', (req, res) => {
  const { did } = req.params;
  if (!did || !did.startsWith('did:key:')) {
    return res.status(400).json({
      error: 'Invalid DID parameter',
      statusCode: 400,
    });
  }

  try {
    const profile = db.getAgentProfile(did);
    res.json({
      data: profile,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to retrieve agent profile: ' + err.message,
      statusCode: 500,
    });
  }
});

/**
 * POST /api/verify
 * Cryptographic verification utility endpoint.
 */
app.post('/api/verify', async (req, res) => {
  const { room, nonce, text, did, sig } = req.body || {};

  if (!room || !nonce || text === undefined || !did || !sig) {
    return res.status(400).json({
      valid: false,
      error: 'Missing required parameters (room, nonce, text, did, sig).',
    });
  }

  try {
    let pubKeyHex = null;
    try {
      const pubKeyBytes = decodeDidKey(did);
      pubKeyHex = Buffer.from(pubKeyBytes).toString('hex');
    } catch (e) {
      return res.json({
        valid: false,
        error: 'Invalid DID format: ' + e.message,
      });
    }

    const payload = `${room}|${nonce}|${text}`;
    const isValid = await verifyTechnocoreSignature(room, nonce, text, did, sig);

    res.json({
      valid: isValid,
      did,
      publicKeyHex: pubKeyHex,
      reconstructedPayload: payload,
    });
  } catch (err) {
    res.status(500).json({
      valid: false,
      error: 'Verification error: ' + err.message,
    });
  }
});

/**
 * GET /api/health
 * Healthcheck and diagnostics.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'technocore-explorer',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    upstream: TECHNOCORE_HOST,
    cache: cache.stats(),
  });
});

/**
 * Fallback handler for SPA client routing
 */
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found', statusCode: 404 });
  }
  next();
});

// Central Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: escapeHtml(message),
    statusCode,
  });
});

// Export app for test suites
module.exports = app;

// Start server if run directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Technocore Explorer running on http://localhost:${PORT}`);
    console.log(`🔒 Upstream Target: ${TECHNOCORE_HOST}`);
    console.log(`⏱️  Cache TTL: ${CACHE_TTL_MS / 1000}s`);
    console.log(`====================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n⚠️  Port ${PORT} is already in use by another process.`);
      console.error(`👉 To free it, run: fuser -k ${PORT}/tcp (or npx kill-port ${PORT})`);
      console.error(`👉 Or start on a different port: PORT=3001 npm run dev\n`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}
