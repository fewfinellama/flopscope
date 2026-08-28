# CLAUDE.md — Flopscope AI Coding Agreement

> Project-specific ruleset for **Flopscope** (https://flopscope.pages.dev).  
> A zero-trust, client-side Technocore room explorer + signature verifier + signal intelligence layer.  
> Built as a pure frontend SPA on Cloudflare Pages. No traditional backend, no Laravel, no PHP.

This file is the single source of truth for how AI assistants (and humans) must work on this codebase.

---

## 0. Precedence Rules

1. This file (`CLAUDE.md`)
2. Any project-specific override notes in `README.md` or `ARCHITECTURE.md`
3. Existing code patterns already in the repo
4. Generic best practices / tool suggestions

**Non-negotiables always win.**

---

## 1. Session Workflow

At the start of every session:

1. Read this file completely.
2. Detect current stack and structure:
   - `js/` modules (app.js, api.js, crypto-verifier.js, protocol-parser.js, store.js, ui.js, etc.)
   - `css/` and any Tailwind / custom styles
   - Cloudflare Pages deployment model
   - Whether any Worker / Pages Function proxy exists
3. Check for `CHANGELOG.md`:
   - If missing → create it (Keep a Changelog format) before doing real work.
   - If present → confirm it reflects recent changes.
4. Ask the user (or decide with them) before starting:
   - Is this KISS (simplest viable approach)?
   - Is this DRY (any logic we can extract/reuse)?
   - Is this YAGNI (are we building only what is needed *now*)?
   - Do we need tests / manual verification steps for this change?
   - Does CHANGELOG.md need an entry?

Never invent architecture that contradicts the current zero-trust, client-side nature of the app.

---

## 2. Project Reality Check (Senior Dev Note)

Flopscope is **not** a full-stack application.

- Primary runtime = browser
- Core value = local Ed25519 verification + live Technocore observation
- Data source = public Technocore endpoints (`technocore.chat`)
- State = in-memory + localStorage / IndexedDB
- Deployment = static assets on Cloudflare Pages (optionally with thin Pages Functions for CORS/proxy only)

Any suggestion that introduces:
- A traditional backend
- User accounts / auth
- Server-side storage of private keys
- Write capability to Technocore from the app itself
- Heavy frameworks that fight the current modular vanilla-ish JS structure

…is almost always wrong unless the user explicitly asks for it.

Prefer extending the existing module pattern over rewriting the app.

---

## 3. Global Non-Negotiables

- **KISS** — simplest solution that satisfies the requirement
- **DRY** — no duplicated logic; extract shared pure functions
- **YAGNI** — build only what is needed for the current phase
- **Zero-trust** — signatures are always verified in the browser; never trust the network for cryptographic claims
- **Read-only by default** — the app must never create DIDs, sign messages, or write to Technocore unless the user is explicitly using a separate Crypto Studio flow that keeps keys local
- **No secrets in code** — no API keys, no private seeds, no hardcoded endpoints that should be configurable
- **Transparent scoring** — every health / quality / originality score must be explainable and deterministic
- **Performance under load** — lobby can exceed 1500–2000 msg/min; scoring and rendering must stay responsive
- CHANGELOG.md must be updated for every session with real work
- Never delete or weaken existing verification logic without explicit approval

---

## 4. Code Conventions

### Language & Style
- Modern JavaScript (ES modules)
- Prefer `const` / `let`, never `var`
- Explicit, readable names over clever short names
- Pure functions for all scoring, filtering, and analysis logic
- Side effects (DOM, localStorage, network) isolated in clear layers (`ui.js`, `api.js`, `store.js`)

### File / Module Organization
```
js/
  app.js                 # orchestration / entry
  api.js                 # Technocore fetching & polling
  crypto-verifier.js     # local Ed25519 verification (sacred)
  protocol-parser.js     # message normalization
  store.js               # application state
  ui.js                  # DOM rendering
  health-scorer.js       # room health (new)
  did-analyzer.js        # DID quality & sybil signals (new)
  farming-patterns.js    # boilerplate detection (new)
  protocol-probes.js     # protocol health checks (new)
  filters.js             # usefulness filters (new)
  utils.js
  theme.js
  toast.js
  identicon.js
  vendor/                # third-party (ed25519 etc.)
```

- One clear responsibility per module
- Export pure functions whenever possible
- Avoid circular dependencies

### Naming
- Files: kebab-case or existing camelCase consistency (match current style)
- Functions: camelCase, verb-first (`scoreRoom`, `isBoilerplate`, `updateDidStats`)
- Constants: UPPER_SNAKE or clear module-level `const`
- CSS classes: follow existing Tailwind + custom patterns

### Comments
- Explain *why*, not *what*
- Human, concise, conversational tone
- Required on non-obvious scoring formulas, probe logic, and any performance trade-off
- Do not narrate every line

---

## 5. Architecture Rules Specific to Flopscope

### Layering
- **Network** (`api.js`) → only talks to Technocore (and any thin proxy)
- **Parsing & Verification** (`protocol-parser.js` + `crypto-verifier.js`) → produce trusted `NormalizedMessage` objects
- **State** (`store.js`) → single source of truth for messages, metrics, DID stats, protocol health
- **Analysis** (`health-scorer.js`, `did-analyzer.js`, `filters.js`, `protocol-probes.js`) → pure or near-pure
- **UI** (`ui.js` + templates) → only reads from store and renders; no business logic

### Zero-Trust Invariants
- Signature verification always happens client-side with the same logic used in Crypto Studio
- Never display a message as “Verified” unless `crypto-verifier.js` has confirmed it
- Scoring modules must never treat an unverified message as a first-class signed DID action

### State Management
- Prefer a simple central store over introducing Redux/Vuex/etc. unless complexity genuinely demands it
- Persist only what is useful across sessions (pinned rooms, watched DIDs, theme, density, last filters) via `localStorage`
- Cap in-memory growth (LRU for DID stats, limited snapshot history)

### Performance Rules
- Scoring on high-velocity rooms must be throttled or windowed
- Never re-render the entire message list on every single new message if a cheaper incremental update is possible
- Heavy analysis (originality, reciprocity windows) should be incremental where feasible
- Profile before adding “clever” caching

---

## 6. Feature-Specific Rules (from Improvement Plan)

When implementing any of the planned features, follow these constraints:

### Room Health & Signal Scoring
- Formula must be public, versioned, and shown in a transparency modal
- All inputs come from already-verified + normalized messages
- Health score is a *signal*, not a moral judgment

### DID Quality & Sybil Radar
- Flags must use neutral language (“one-shot”, “template-heavy”, “high-reciprocity”)
- Originality and reciprocity logic must be deterministic and documented
- Never store private keys or attempt to correlate off-protocol identity

### Usefulness Filters
- Pure client-side filtering of already-loaded data
- Composable and explainable

### Protocol Health Monitor
- Probes are read-only and rate-limited
- Failures are diagnostic, never accusatory in the UI
- Must not contribute to Technocore load in any meaningful way

### Historical Snapshots & Trends
- Keep data local and bounded
- Sparklines and charts are progressive enhancement

### Nice-to-haves
- Export = only the current filtered/verified window
- Pin / Watch = localStorage only
- Side-by-side comparison = pure client-side
- Density / Power User mode = CSS + state flag, no separate codebase

---

## 7. UI / UX Non-Negotiables

- Preserve the existing dark, dense, technical aesthetic unless the user asks for a redesign
- Progressive disclosure: casual users see clean health pills; power users can open formula modals and DID inspectors
- Neutral, precise language — never “spam account” or “bad actor”
- Loading and empty states must be honest (“No high-signal messages in this window”)
- Command Palette (`⌘K`) is a first-class navigation surface for power users
- Mobile must remain usable even if the densest power-user views are desktop-first
- Accessibility: keyboard navigation for main actions, sufficient contrast, focus states

When adding new panels (DID Inspector, Protocol Health, Compare, Methodology):
- Prefer right-side drawers or focused modals over full page navigations where possible
- Keep the main room view as the center of gravity

---

## 8. Testing & Verification

Because this is a client-side cryptographic and analytical tool:

- Manual verification steps are required for any change to:
  - Signature verification
  - Health / originality / reciprocity formulas
  - Protocol probes
- Prefer small, pure unit-testable functions for scorers and filters (can be run in Node or browser console)
- Before considering work done:
  - Test against live Technocore rooms (especially high-velocity ones like `/r/lobby`)
  - Confirm verified badges still only appear on correctly signed messages
  - Confirm scoring does not freeze the UI under load
- Never weaken cryptographic checks to “make tests pass”

---

## 9. Security & Privacy

- Private keys never leave the browser and never touch any server controlled by Flopscope
- No analytics that capture message content or DIDs without explicit, documented consent
- localStorage data is considered user-owned; do not phone it home
- Any future Cloudflare Worker / Pages Function must be strictly limited to proxying or CORS helpers — never key handling

---

## 10. Documentation Requirements

- Every new scoring module must have a short header comment explaining purpose + formula version
- `CHANGELOG.md` entry for every meaningful session
- A public **Methodology** view (or section) must stay in sync with the actual formulas in code
- README should clearly state: “Not affiliated with Flop Labs. No airdrop guaranteed. Read-only observer.”

---

## 11. Git & Commit Conventions

Use Conventional Commits:

```
feat(health): add room health scoring and transparency modal
fix(verifier): correct signature coverage after server text sweep
refactor(store): extract DID stats into dedicated analyzer
docs: update methodology for health formula v1
chore: throttle scoring on high-velocity rooms
```

Branch naming examples:
- `feat/room-health-scoring`
- `feat/did-radar`
- `fix/protocol-probe-nonce`
- `refactor/normalize-message-schema`

---

## 12. Pre-Completion Checklist

Before marking any work done:

**Principles**
- [ ] KISS?
- [ ] DRY?
- [ ] YAGNI?
- [ ] Still zero-trust and read-only?

**Code**
- [ ] Pure analysis logic separated from UI and network?
- [ ] Scoring / flags use neutral language?
- [ ] Formulas documented and transparent?
- [ ] No new circular dependencies?
- [ ] Performance acceptable on live high-velocity rooms?

**Crypto & Trust**
- [ ] Verified badge only appears after local verification?
- [ ] No private key handling introduced?

**UI / UX**
- [ ] Progressive disclosure respected?
- [ ] Empty / loading / error states honest?
- [ ] Works with existing theme and density directions?

**Delivery**
- [ ] CHANGELOG.md updated?
- [ ] Tests written and run for new pure logic?
- [ ] Manual verification against live Technocore performed?
- [ ] Methodology page / comments updated if formulas changed?

---

## 13. Senior Developer Input (Standing Guidance)

1. **Ship Room Health first.**  
   Everything else becomes more useful once people can see quality at a glance. Resist the urge to build the full DID Radar + Protocol Monitor + Trends in one go.

2. **Protect the verifier.**  
   `crypto-verifier.js` is the most important file in the project. Treat changes to it with extreme caution.

3. **Scoring is a product feature, not just an algorithm.**  
   The transparency modal and neutral language matter as much as the numbers. If users cannot understand or trust the score, it has failed.

4. **Do not fight Technocore’s nature.**  
   It is ephemeral, high-noise, and deliberately minimal. Flopscope’s job is to observe and measure it, not to pretend it is a polished social network.

5. **localStorage is not a database.**  
   Keep persisted data small, versioned, and easily clearable. Prefer recomputing from live data when in doubt.

6. **When in doubt, add a Command Palette entry** rather than more permanent navigation chrome.

7. **Measure real rooms.**  
   Especially `/r/lobby`, `/r/technocore`, and any high-signal rooms the community starts using. Synthetic data will lie to you.

---

## 14. What This File Is Not

- It is not a license to rewrite the app in React/Vue/Svelte unless explicitly requested.
- It is not permission to add a backend “just in case”.
- It is not a substitute for reading the current source modules before changing them.

---

*This agreement is living. Update it when the architecture or priorities of Flopscope materially change.*
