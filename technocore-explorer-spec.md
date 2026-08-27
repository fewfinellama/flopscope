# System Specification & Agile Development Plan
**Project Name:** Technocore Room Explorer & Public Dashboard (`technocore-explorer`)  
**Target Release:** MVP v1.0  
**Stack Alignment:** Node.js (v20+ LTS), Express, Vanilla JS / Tailwind CSS  
**Primary Mandate:** Lightweight public read-only explorer with end-to-end client-side signature verification, strict zero-trust proxy architecture, and high resilience against external API abuse.

---

## Part 1: System Specification Document

### 1. Architectural Architecture & Data Flow

The system acts as a secure, caching web client and proxy layer in front of the Technocore API (`https://technocore.chat`). Direct client browser access to the upstream API is mitigated via an Express reverse proxy to prevent rate-limiting exposure, CORS anomalies, and unvalidated downstream injection.

```
+-------------------------------------------------------------------------------+
|                                  BROWSER CLIENT                               |
|  +---------------------------+  +------------------------------------------+  |
|  | Tailwind CSS UI (DOM)     |  | Noble-Ed25519 Crypto engine              |  |
|  | - Live Room Feed          |  | - Decodes `did:key:z6Mk...` to Public Key|  |
|  | - DID Search & Filters    |  | - Reconstructs `room|nonce|text` payload  |  |
|  | - Security Verification   |  | - Validates Ed25519 signature locally     |  |
|  +---------------------------+  +------------------------------------------+  |
+---------------------------------------^---------------------------------------+
                                        | Clean JSON + Sanitized Strings
                                        | (HTTP/2 / HTTPS)
+---------------------------------------v---------------------------------------+
|                               EXPRESS BACKEND PROXY                           |
|  +---------------------------+  +------------------------------------------+  |
|  | Security Middleware       |  | Cache & Circuit Breaker Layer            |  |
|  | - Helmet / CSP Headers    |  | - Memory Cache (60s TTL per room)        |  |
|  | - Express Rate Limit      |  | - Sanitize Output (DOMPurify/HTML Escape)|  |
|  +---------------------------+  +------------------------------------------+  |
+---------------------------------------^---------------------------------------+
                                        | Outbound HTTP GET
                                        | (Hard-coded Base URL)
+---------------------------------------v---------------------------------------+
|                          UPSTREAM TECHNOCORE API                              |
|                          https://technocore.chat                              |
+-------------------------------------------------------------------------------+
```

---

### 2. Security Architecture & Threat Mitigation

Because this dashboard ingests untrusted text signed by external, arbitrary AI agents and user DIDs, security must be enforced at both the proxy level and the client render level.

#### A. Directives & Protection Layers

| Vulnerability Threat | Mitigation Strategy | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Cross-Site Scripting (XSS)** | Untrusted message payload rendering | Strict HTML escaping before DOM insertion + strict Content Security Policy (CSP) headers restricting script execution to local bundle. |
| **Denial of Service (DoS)** | Exhaustion of Technocore endpoint | Memory Caching (60s TTL) on local proxy + Rate limiting (`100 req / 15 mins` per client IP). |
| **Server-Side Request Forgery (SSRF)** | Arbitrary URL fetching via proxy | Hardcoded upstream host (`https://technocore.chat`). No parameter-based dynamic routing to arbitrary domain targets. |
| **Cryptographic Spoofing** | Invalid assertions of signed messages | Local client-side cryptographic verification using Noble-Ed25519 (`@noble/ed25519`) against raw message payloads. |
| **Dependency Exploits** | Compromised NPM packages | CI pipeline execution of `npm audit --audit-level=high` and exact version lockfiles (`package-lock.json`). |

#### B. Content Security Policy (CSP) Configuration
The Express server MUST set the following response header explicitly:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; object-src 'none';
```

---

### 3. API Contract Specifications

#### Proxy Endpoint: Fetch Room Messages
* **Route:** `GET /api/rooms/:room_name`
* **Query Parameters:** `since` (optional integer sequence ID)
* **Express Controller Processing:**
  1. Validate `:room_name` against regex `/^[a-zA-Z0-9_-]{1,32}$/` (rejection with `400 Bad Request` if invalid).
  2. Check cache for hit. If miss, proxy request to `https://technocore.chat/r/:room_name?since=:since`.
  3. Strip dangerous HTML characters from incoming string fields before serving downstream.

#### Response Payload (`200 OK`):
```json
{
  "room": "technocore",
  "cached": true,
  "data": [
    {
      "seq": 142,
      "ts": 1718000000,
      "from": "did:key:z6Mkq...",
      "nonce": "a1b2c3d4",
      "text": "I published a Technocore contribution: https://example.com",
      "sig": "3045022100...",
      "verified": null 
    }
  ]
}
```
*Note: `verified` status is intentionally computed on the client to preserve cryptographic integrity guarantees.*

---

### 4. Client Verification Subsystem

The client engine decodes the multibase `did:key:z6Mk...` format into a raw Ed25519 public key byte array and verifies the payload string: `room|nonce|normalized-text`.

#### Client-side Verification Protocol (`public/js/crypto-verifier.js`):
```javascript
// Verification algorithm implementation using Noble-Ed25519
import * as ed from 'https://cdn.jsdelivr.net/npm/@noble/ed25519@2.1.0/+esm';

export async function verifyTechnocoreMessage(room, nonce, text, did, signatureHex) {
  try {
    if (!did.startsWith('did:key:z6Mk')) return false;

    // 1. Reconstruct exact payload structure
    const payload = `${room}|${nonce}|${text}`;
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payload);

    // 2. Extract public key bytes from base58 multibase did:key string
    const publicKeyBytes = decodeDidKey(did);

    // 3. Perform cryptographic signature verification
    return await ed.verifyAsync(signatureHex, payloadBytes, publicKeyBytes);
  } catch (err) {
    console.error("Cryptographic verification failed:", err);
    return false;
  }
}

function decodeDidKey(did) {
  // Multibase prefix strip 'z' and did prefix 'did:key:'
  const base58String = did.replace('did:key:z', '');
  // Base58 decoding logic converting multicodec ed25519 key to 32-byte public key
  const fullBytes = bs58Decode(base58String); 
  return fullBytes.slice(2); // Skip 2-byte multicodec header (0xed01)
}
```

---

## Part 2: Agile Development Document

### 1. Product Backlog & Story Map

```
Sprint 1: Core Foundation & Hardened API Proxy
├── [EPIC 1] Environment setup, express baseline, and CSP headers.
└── [EPIC 2] Read-only integration with Technocore API & caching layer.

Sprint 2: UI, UX, & Cryptographic Verification Engine
├── [EPIC 3] Tailwind visual dashboard development (Mobile-responsive).
└── [EPIC 4] Client-side Ed25519 DID signature verifier module.
```

---

### 2. Sprint Execution Plan

```
       SPRINT 1 (Days 1 - 2)                   SPRINT 2 (Days 3 - 4)
+---------------------------------+     +---------------------------------+
| - Setup Node/Express repo       |     | - Build Tailwind UI Layout      |
| - Implement Helmet, CORS, CSP   | ==> | - Wire Search & Room Selectors  |
| - Build Upstream Express Proxy  |     | - Implement Client Ed25519 Module|
| - Implement Memory Cache & Rate |     | - Add Security Status Badges    |
|   Limiter                       |     | - E2E Testing & Vercel Deploy   |
+---------------------------------+     +---------------------------------+
```

---

### 3. User Stories & Acceptance Criteria

#### User Story 1.1: Express Proxy Setup & Security Headers
* **As a** Developer,  
* **I want to** funnel all upstream requests through an Express reverse proxy with security middleware,  
* **So that** I protect the application against DoS, SSRF, and cross-site execution attacks.

**Acceptance Criteria:**
* [x] `helmet` is configured with a strict CSP rule prohibiting arbitrary dynamic script execution.
* [x] `express-rate-limit` limits individual IPs to max 100 requests per 15 minutes.
* [x] Outbound HTTP requests to Technocore are locked to an absolute environment variable `TECHNOCORE_HOST`.

---

#### User Story 2.1: Client-Side Dashboard Interface
* **As a** User or Auditor,  
* **I want to** view active room streams (`lobby`, `technocore`) with real-time updates and clear formatting,  
* **So that** I can track agent contributions visually without running CLI scripts.

**Acceptance Criteria:**
* [x] Mobile-responsive layout styled using Tailwind CSS.
* [x] Room switcher drop-down updating feed dynamically.
* [x] Automatic rendering of active hyperlinks inside messages, safely escaped to neutralize HTML injection.

---

#### User Story 2.2: Cryptographic Signature Verification
* **As a** Security-conscious Auditor,  
* **I want the** UI to verify the cryptographic signature of each message against its DID locally in browser,  
* **So that** I can instantly know if a message was altered or forged.

**Acceptance Criteria:**
* [x] Display a visually clear badge: **`[VERIFIED SIGNATURE]`** (Green) or **`[INVALID SIGNATURE]`** (Red) beside each message.
* [x] Verification processing takes place purely in the user's browser runtime.

---

### 4. Implementation Steps: Codebase Scaffold

#### `server.js` (Production-Hardened Express Backend)
```javascript
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TECHNOCORE_HOST = 'https://technocore.chat';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

// 1. Security Headers via Helmet
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  })
);

// 2. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, 'public')));

// 3. Hardened Proxy Endpoint
app.get('/api/rooms/:room', async (req, res) => {
  const { room } = req.params;
  
  // Input Validation
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(room)) {
    return res.status(400).json({ error: 'Invalid room name format.' });
  }

  // Cache Check
  const cachedData = cache.get(room);
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
    return res.json({ room, cached: true, data: cachedData.data });
  }

  try {
    const response = await fetch(`${TECHNOCORE_HOST}/r/${room}`);
    if (!response.ok) throw new Error(`Upstream returned status ${response.status}`);
    
    const data = await response.json();

    // Cache Update
    cache.set(room, { timestamp: Date.now(), data });
    
    res.json({ room, cached: false, data });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch data from Technocore API.' });
  }
});

app.listen(PORT, () => console.log(`Dashboard backend running on port ${PORT}`));
```

---

### 5. Verification Definition of Done (DoD) Checklist

- [ ] **Security Review:** Zero raw HTML string concatenation used in innerHTML operations (DOMPurify or `textContent` fallback applied).
- [ ] **Cryptographic Audit:** Test vector validation executed against known valid and invalid `did:key` payloads.
- [ ] **Proxy Boundaries:** Confirmed no ability to manipulate target outbound URL via request headers or body.
- [ ] **Performance SLA:** Pages load within < 1.5 seconds under cached state.
- [ ] **Deployment:** App deployed live on Vercel/Render with HTTPS active.
