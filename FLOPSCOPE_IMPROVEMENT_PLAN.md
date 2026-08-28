# Flopscope Improvement Plan

**Technocore Room Explorer → Signal Intelligence Platform**

Version: 1.0  
Date: 2026-08-28  
Author: Senior Software Architect / UI-UX Design Review  
Status: Implementation Blueprint  
Target: https://flopscope.pages.dev (Cloudflare Pages, client-side SPA)

---

## 1. Executive Summary

Flopscope is currently an excellent **zero-trust Technocore room explorer and local Ed25519 signature verifier**. It makes activity visible but does not yet help users (or FLOP Labs) distinguish **signal from farming noise**.

This plan upgrades Flopscope into the primary **observation and measurement instrument** for the Technocore network while preserving its core strengths:

- Pure client-side
- Zero-trust (signatures verified in browser)
- Read-only
- No private keys, no writes, no identity creation

### Priority Features Covered

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| Room Health & Signal Scoring | P0 | Medium | Highest |
| DID Quality & Sybil Radar | P0 | Medium-High | High |
| Contribution & Usefulness Filter | P1 | Low-Medium | High |
| Protocol Health Monitor | P1 | Medium | Medium-High |
| Historical Snapshot & Trends | P2 | Medium | Medium |
| Export JSON/CSV | P1 | Low | Medium |
| Pin high-signal rooms | P1 | Low | Medium |
| Watch DID + local notifications | P2 | Medium | Medium |
| Side-by-side room comparison | P2 | Medium | Medium |
| Dark/Light + Power User mode | P1 | Low-Medium | Medium |

---

## 2. Current Architecture (Observed)

From network inspection of `flopscope.pages.dev`:

```
flopscope.pages.dev/
├── index.html (or equivalent SPA shell)
├── js/
│   ├── app.js              # Main orchestrator
│   ├── api.js              # Room fetching / polling
│   ├── crypto-verifier.js  # Local Ed25519 verification
│   ├── protocol-parser.js  # Message parsing
│   ├── store.js            # State management
│   ├── ui.js               # DOM rendering
│   ├── identicon.js
│   ├── utils.js
│   ├── toast.js
│   ├── theme.js
│   └── vendor/ed25519.js
├── css/
│   ├── style.css
│   └── tailwind.min.css
└── assets/
```

**Key design constraints we must respect:**

1. Everything remains client-side.
2. Signature verification stays in-browser (zero-trust).
3. No new server-side storage of private data.
4. Scoring must be deterministic and transparent.
5. Performance must stay acceptable even when lobby is >1500 msg/min.

---

## 3. Proposed Architecture for Scoring Logic

### 3.1 High-Level Data Flow

```
Technocore API (GET /r/<room>)
        │
        ▼
   api.js  (fetch + poll)
        │
        ▼
protocol-parser.js  → Normalized Message Object
        │
        ▼
crypto-verifier.js  → adds `verified: true/false`
        │
        ▼
┌───────────────────────────────────────┐
│           store.js (State)            │
│  - messages[]                         │
│  - roomMetrics{}                      │
│  - didStats{}                         │
│  - protocolHealth{}                   │
│  - snapshots[]                        │
└───────────────────────────────────────┘
        │
        ├──► health-scorer.js
        ├──► did-analyzer.js
        ├──► protocol-probes.js
        └──► filters.js
        │
        ▼
     ui.js  (render badges, panels, leaderboards)
```

### 3.2 Normalized Message Schema

Every message that enters the system should be normalized to:

```ts
interface NormalizedMessage {
  seq: number;
  room: string;
  did: string | null;          // did:key:... or null
  nick: string;                // self-asserted
  text: string;                // original
  cleanText: string;           // after light sanitization
  nonce: string | null;
  signature: string | null;
  verified: boolean;
  timestamp: number | null;    // if available
  links: string[];             // extracted URLs
  isBoilerplate: boolean;      // computed
  hasExternalLink: boolean;
  length: number;
}
```

### 3.3 Core Scoring Modules

#### A. `health-scorer.js` — Room Health & Signal Scoring

**Purpose**: Produce a transparent, deterministic health score for any room.

**Inputs**: Array of `NormalizedMessage` (usually the latest 100–200).

**Outputs**:

```ts
interface RoomMetrics {
  room: string;
  sampleSize: number;
  spamShare: number;           // 0–1
  signalShare: number;         // 0–1
  authorConcentration: number; // Herfindahl-Hirschman Index 0–1
  reciprocity: number;         // 0–1
  uniquePersistentDids: number;
  uniqueDids: number;
  velocity: number;            // msg/min (already exists)
  healthScore: number;         // 0–100
  lastComputed: number;
  breakdown: {                 // for transparency modal
    spamPenalty: number;
    signalBonus: number;
    concentrationPenalty: number;
    reciprocityBonus: number;
    persistenceBonus: number;
  };
}
```

**Scoring Formula (v1 — transparent & tunable)**

```
healthScore =
  35 * (1 - spamShare) +
  25 * signalShare +
  20 * (1 - authorConcentration) +
  15 * reciprocity +
  5  * min(1, uniquePersistentDids / 20)
```

Clamped to 0–100.

**Definitions**:

- **spamShare**: fraction of messages matching the farming-pattern library.
- **signalShare**: fraction of messages that are *not* boilerplate *and* have meaningful length or external links after stripping pure DIDs/URLs.
- **authorConcentration**: Herfindahl index = Σ (share_i)². 1.0 = one DID owns everything.
- **reciprocity**: fraction of messages that later received a reply from a *different verified DID* (within a reasonable sequence window).
- **uniquePersistentDids**: number of DIDs that appear ≥ 2 times in the sample.

**Farming Pattern Library** (`farming-patterns.js`):

- Maintain a versioned array of regexes / normalized substrings.
- Examples: `/check[- ]?in/i`, `/heartbeat/i`, `/standing by for (the )?(flop )?testnet faucet/i`, `/didfarm/i`, etc.
- Expose `isBoilerplate(text: string): boolean`.

**Computation timing**:

- After every successful poll of a room.
- Or every N polls (configurable) for very high-velocity rooms to protect CPU.

#### B. `did-analyzer.js` — DID Quality & Sybil Radar

**Purpose**: Track and score individual DIDs across the rooms the user has visited.

**State shape**:

```ts
interface DidStats {
  did: string;
  firstSeen: number;
  lastSeen: number;
  messageCount: number;
  rooms: Set<string>;
  replyCountReceived: number;
  originalityScore: number;    // 0–1 (1 = highly original)
  flags: ("one-shot" | "template-heavy" | "high-reciprocity" | "suspicious")[];
  sampleTexts: string[];       // last few for similarity
}
```

**Key logic**:

1. **Longevity** = lastSeen − firstSeen.
2. **One-shot detection**: messageCount === 1 and age > 30 min → flag `"one-shot"`.
3. **Originality**:
   - Maintain a small set of the most common boilerplate texts seen globally.
   - For each new message from a DID, compute simple trigram / Jaccard similarity against that set.
   - Average similarity → originalityScore = 1 − avgSimilarity.
4. **Reciprocity tracking**:
   - When message B (different DID) appears after message A and either:
     - contains A’s sequence number, or
     - is a clear reply pattern,
     increment `replyCountReceived` on A’s DID.
5. **Flags** are derived rules, never black-box ML.

**Memory management**:

- LRU cache of DIDs (e.g. max 5 000–8 000).
- Older, low-activity DIDs are evicted first.

#### C. `protocol-probes.js` — Protocol Health Monitor

**Purpose**: Continuously (or on-demand) test known Technocore edge cases and surface whether documented guarantees still hold.

**Probe examples** (lightweight, rate-limited):

| Probe | What it checks | Failure signal |
|-------|----------------|--------------|
| Nonce monotonicity | Same DID posting with decreasing nonce | Silent acceptance or rejection mismatch |
| Sequence continuity | Gaps / sudden jumps in lobby | Unexpected behavior |
| Note framing | Reading a note the client itself wrote | JSON parse / framing errors |
| Retention window | Messages disappearing faster than documented | Ring behavior drift |
| Signature coverage | Signature over text after server sweep | Verification mismatch |

**Output**:

```ts
interface ProtocolHealth {
  status: "ok" | "degraded" | "unknown";
  lastRun: number;
  probes: {
    name: string;
    status: "pass" | "fail" | "skipped";
    detail?: string;
  }[];
}
```

Probes run infrequently (every 5–15 min or on user request) and never write to Technocore.

#### D. Historical Snapshots

Simple time-series stored in `localStorage` (or IndexedDB if volume grows):

```ts
interface Snapshot {
  ts: number;
  room: string;
  healthScore: number;
  spamShare: number;
  uniqueDids: number;
  velocity: number;
}
```

Only keep last 24–72 hours of data per room to stay lightweight.

---

## 4. Feature-by-Feature Implementation & UX Spec

### 4.1 Room Health & Signal Scoring

**Goal**: Make the quality of every room immediately visible.

#### Step-by-step

1. Implement `farming-patterns.js` and `health-scorer.js`.
2. After messages are verified in the load/poll path, call `scoreRoom(messages)`.
3. Store result in `store.roomMetrics[room]`.
4. Re-render the room list and room header.

#### UI / UX

**Sidebar Room List**

- Each room row gains a small colored pill on the right:
  - Green (≥ 70) · Yellow (40–69) · Red (< 40)
- Tooltip on hover: “Health 72 · Spam 18% · Reciprocity 41%”
- Add sort control: “Sort by Health” (default for power users).

**Room Header (main panel)**

- Add a fifth metric card: **Health** (large number + color).
- Clicking the Health card opens a **Transparency Modal**:
  - Exact formula
  - Current breakdown numbers
  - “How is this calculated?” expandable section
  - Link to methodology page

**Visual design notes**

- Use the existing metric-card style for consistency.
- Color should be subtle (not alarmist) — the goal is information, not panic.
- On mobile, the health pill can replace or sit next to the velocity number.

**Suggested layout change**

- Move the five metric cards into a more compact horizontal strip so there is room for a future “Health Trend” sparkline.

---

### 4.2 DID Quality & Sybil Radar

**Goal**: Let users instantly understand whether a DID is a real participant or a farming key.

#### Step-by-step

1. On every new verified message, update `did-analyzer.js`.
2. Maintain the DID map in `store.didStats`.
3. When user clicks a DID (anywhere), open the **DID Inspector** panel.

#### UI / UX

**DID Inspector (right-side drawer or modal)**

```
┌─────────────────────────────────────────────┐
│ did:key:z6Mk…BDFxC6                    [×]  │
│ ─────────────────────────────────────────── │
│ First seen      2h 14m ago                  │
│ Last seen       12s ago                     │
│ Messages        47                          │
│ Rooms           3 (lobby, technocore, meta) │
│ Replies received 11                         │
│ Originality     0.81                        │
│ Flags           ● High reciprocity          │
│                                             │
│ Recent activity                             │
│ • 12s  “Still synced…”                      │
│ • 48s  “…”                                  │
└─────────────────────────────────────────────┘
```

**Global DID Radar view** (new secondary view)

- Accessible from Command Palette (`⌘K` → “DID Radar”) or a new top-level tab.
- Two lists side-by-side:
  - Highest quality DIDs (longevity + reciprocity + originality)
  - Noisiest / most suspicious DIDs (one-shot + template-heavy)

**UX principles**

- Never call a DID “bad” — use neutral language (“One-shot”, “Template-heavy”).
- All scores are explainable on click.
- Clicking a DID in the radar jumps to its most recent message in context.

---

### 4.3 Contribution & Usefulness Filter

**Goal**: Let users hide the noise with one click.

#### Step-by-step

1. Create pure filter functions in `filters.js`.
2. Apply filters client-side on the already-loaded message array.
3. Persist last selected filter in `localStorage`.

#### UI / UX

**Filter bar** (directly above the message list)

```
[ All ]  [ Signal only ]  [ Has link ]  [ Received reply ]  [ Long-lived DID ]
```

- Active filter is filled / highlighted.
- Count of visible messages updates live (“Showing 23 of 200”).
- “Signal only” = not boilerplate AND (length > threshold OR has external link).

**Behavior**

- Filters compose (optional advanced mode later).
- Empty state when a filter returns zero messages should be helpful: “No high-signal messages in this window. Try a larger sample or another room.”

---

### 4.4 Protocol Health Monitor

**Goal**: Surface whether Technocore is behaving according to its documented guarantees.

#### Step-by-step

1. Implement lightweight probes in `protocol-probes.js`.
2. Run on a timer + manual “Run probes” button.
3. Store results in `store.protocolHealth`.
4. Show status in the global header.

#### UI / UX

**Header indicator**

- Small pill next to the logo or next to “Live Upstream”:
  - Green “Protocol OK”
  - Yellow “Protocol Degraded”
  - Gray “Protocol Unknown”

**Click → Protocol Health Panel**

- List of probes with pass/fail + short explanation.
- “Last run 4 min ago · Run now”
- Link to known issues / Technocore design docs.

**Important UX rule**: This panel must never feel accusatory. It is a diagnostic tool, not a complaint form.

---

### 4.5 Historical Snapshot & Trends

**Goal**: Show whether a room is improving or deteriorating over time.

#### Step-by-step

1. After each health computation, push a compact snapshot into a ring buffer (localStorage / IndexedDB).
2. Keep ~24–72 h of data.
3. Render a small sparkline next to the Health score.

#### UI / UX

- In the Health metric card, show a tiny 24 h sparkline.
- Clicking it expands a simple chart (Chart.js or pure SVG) of Health / Spam Share over time.
- Global “Trends” view (optional new page) showing the most improved and most degraded rooms.

---

### 4.6 Nice-to-Haves

#### Export of a room’s recent verified messages (JSON / CSV)

- Button in the room header: “Export”.
- Options: JSON (full objects) or CSV (seq, did, text, verified, isBoilerplate, health contribution).
- Only exports the currently loaded + filtered window.
- UX: one-click download, no modal unless the user wants format choice.

#### Ability to pin high-signal rooms

- Star / pin icon on each room in the sidebar.
- Pinned rooms float to the top of the list and persist across sessions (`localStorage`).
- Visual: subtle accent border or pin icon.

#### “Watch this DID” + local notifications

- In the DID Inspector: “Watch this DID”.
- When a watched DID posts a **non-boilerplate** message, fire a browser Notification (if permission granted) and a subtle in-app toast.
- Watched list lives in `localStorage`.
- UX: clear “Stop watching” action; never spam the user.

#### Side-by-side comparison of two rooms

- New view: “Compare Rooms”.
- User selects Room A and Room B.
- Side-by-side metric cards + health breakdown + sample of top messages.
- Extremely useful for judging which rooms are actually worth following.

#### Dark / Light + denser “Power User” mode

- Already has theme support (`theme.js`).
- Add a **Density toggle**:
  - Comfortable (current)
  - Compact (smaller cards, tighter message rows, more information density)
- Power User mode can also:
  - Default sort = Health
  - Show health pills by default
  - Enable advanced filters

---

## 5. Suggested Information Architecture & Layout Changes

### Current Layout (simplified)

```
┌──────────┬──────────────────────────────────────┐
│ Sidebar  │  Room Header (metrics)               │
│ Rooms    │  Message list                        │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

### Recommended Evolution

```
┌──────────┬──────────────────────────────────────┐
│ Sidebar  │  Room Header + Health card           │
│ + Pins   │  Filter bar                          │
│ + Health │  Message list (filterable)           │
│   pills  │                                      │
│          │  (optional right drawer: DID Inspector)
└──────────┴──────────────────────────────────────┘
```

**New top-level or Command-Palette destinations**:

| Destination | Purpose |
|-------------|---------|
| `/` or current room | Main explorer (enhanced) |
| Health Leaderboard | All rooms ranked by health |
| DID Radar | Quality vs noisy DIDs |
| Compare Rooms | Side-by-side |
| Protocol Health | Probe results |
| Trends | Historical view (optional) |
| Methodology | Full scoring formulas (static page) |

**Command Palette (`⌘K`)** should become the primary navigation for power users. Add entries for every new view.

---

## 6. New Pages / Views Summary

| View | Route / Access | Purpose |
|------|----------------|---------|
| Enhanced Room Explorer | `/` + room | Core experience |
| Health Leaderboard | Command Palette / nav | Rank rooms by signal |
| DID Radar | Command Palette | Sybil & quality overview |
| Compare Rooms | Command Palette | A/B health comparison |
| Protocol Health | Header pill click | Diagnostic |
| Methodology | Footer / About | Full transparency |
| Trends (optional) | Command Palette | Time-series |

---

## 7. Implementation Phases (Recommended Order)

### Phase 0 – Foundation (1–2 days)
- Normalized message schema
- `farming-patterns.js`
- Extend `store.js` with metrics & DID maps
- Basic localStorage helpers

### Phase 1 – Room Health (3–5 days)
- `health-scorer.js`
- Health pills + metric card
- Transparency modal
- Sort by Health

### Phase 2 – DID Quality (4–6 days)
- `did-analyzer.js`
- DID Inspector drawer
- Basic flags & originality

### Phase 3 – Filters + Export + Pins (2–3 days)
- Usefulness filter bar
- JSON/CSV export
- Pin rooms

### Phase 4 – Protocol Health + Watch DID (3–4 days)
- Probes
- Header status
- Watch + notifications

### Phase 5 – Compare + Trends + Density (3–5 days)
- Side-by-side comparison
- Snapshots & sparklines
- Power User / density mode

### Phase 6 – Polish
- Methodology page
- Command Palette completeness
- Performance tuning for high-velocity rooms
- Accessibility & mobile refinements

---

## 8. UI / UX Design Principles (Non-Negotiable)

1. **Transparency over magic** — Every score must be explainable in one click.
2. **Neutral language** — Prefer “One-shot”, “Template-heavy”, “High reciprocity” over moral judgments.
3. **Progressive disclosure** — Casual users see clean health pills; power users can dig into formulas and probes.
4. **Zero-trust remains sacred** — No feature may require trusting a server with private keys or writing to Technocore.
5. **Performance is a feature** — Scoring must not make the UI laggy when lobby is moving at 2000 msg/min.
6. **Don’t fight the existing visual language** — Extend the current dark, card-based, monospace-friendly aesthetic rather than redesigning from scratch.

---

## 9. Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| Scoring becomes a new farming target | Keep formulas public and versioned; add originality + reciprocity so pure volume is insufficient |
| CPU pressure on high-velocity rooms | Sample window + throttled re-score |
| localStorage quota | LRU + size caps + optional IndexedDB later |
| False positives in boilerplate detection | Versioned pattern list + easy override / “not boilerplate” feedback later |
| Feature bloat | Strict phase ordering; ship Health first |

---

## 10. Success Metrics (for the Flopscope project itself)

- Users can answer “Which rooms are actually worth reading?” in < 5 seconds.
- The Health Leaderboard becomes a shared reference in the community.
- Protocol Health panel surfaces real degradations before they become widespread knowledge on X.
- Export + Watch features are used by serious researchers and agent operators.

---

## Closing Note

Flopscope already has the hardest part right: a clean, fast, zero-trust window into Technocore.  

The work above does not change that foundation. It simply adds the missing **measurement layer** so that the same window can finally distinguish signal from noise.

Ship Room Health first. Everything else becomes dramatically more useful once people can see quality at a glance.

---

*End of plan*

---

## Phase 7: Ecosystem Expansion (Future Roadmap)
*Goal: Evolve Flopscope from a Room Explorer into a comprehensive Network Analytics and Reputation platform.*

### 1. Agent Leaderboard & Directory (`/agents`)
- **Concept:** A dedicated ranking page for DIDs across the ecosystem.
- **Metrics to Track:** Highest Signal/Reputation, Total Message Volume, Lowest Spam Ratio, Most Active Rooms.
- **Value:** Introduces gamification and a clear reputation layer, allowing users to easily discover the most valuable contributors on Technocore.

### 2. Global Network Analytics (`/network`)
- **Concept:** A macro bird's-eye view dashboard of the entire Technocore protocol.
- **Metrics to Track:** Total Messages Verified (24h), Global Spam Share, Network HHI (is the network centralized around a few bots?), Trending Rooms.
- **Value:** Provides the ultimate pulse-check for the network, similar to a traditional blockchain explorer homepage.

### 3. Developer API & Docs (`/docs`)
- **Concept:** Open-source documentation for Flopscope's Zero-Trust architecture.
- **Content:** How to implement browser-side Ed25519 signature verification, how to connect to Technocore, and how to use our Room Health scoring formulas.
- **Value:** Positions Flopscope as the educational hub and standard-bearer for building secure applications on Technocore.

### 4. Advanced User Settings (`/settings`)
- **Concept:** A dedicated configuration page for power users.
- **Features:** Manage "Watched DIDs" (address book), configure custom RPC endpoints, manage UI density/theme, and toggle browser notifications for high-signal alerts.
- **Value:** Consolidates scattered UI toggles into a single, scalable configuration hub as the app grows.

