/**
 * Protocol Health Monitor — protocol-probes.js
 * Version: 1.0.0
 *
 * Lightweight, read-only diagnostic probes for Technocore network behavior.
 * Probes run infrequently (every 10 min or on demand) and NEVER write to Technocore.
 *
 * Outputs a ProtocolHealth object stored in state.protocolHealth.
 *
 * Probe catalogue (v1):
 *   1. sequence-continuity  — Detects unexpected gaps in lobby sequence numbers
 *   2. message-framing      — Validates that recent messages have required fields (seq, text)
 *   3. signature-coverage   — Checks what fraction of recent messages carry a signature
 *   4. velocity-sanity      — Flags if the room appears to have stalled (0 messages in last poll)
 *   5. did-format           — Validates that signed DIDs use the expected did:key:z6Mk prefix
 */

export const PROBES_VERSION = '1.0.0';

// ─── Pure Probe Evaluators ─────────────────────────────────────────────────
// These are pure functions — testable in Node without a DOM or live network.

/**
 * Probe 1: Sequence Continuity
 * Detects gaps larger than the expected fan-out in a message window.
 * A gap > MAX_GAP suggests messages may have been dropped or rolled off.
 *
 * @param {number[]} seqs - Sorted ascending list of sequence numbers
 * @param {number} maxGap - Threshold above which a gap is flagged (default 500)
 * @returns {{ status: 'pass'|'fail'|'skipped', detail: string }}
 */
export function probeSequenceContinuity(seqs, maxGap = 500) {
  if (!seqs || seqs.length < 2) {
    return { status: 'skipped', detail: 'Not enough messages to evaluate sequence continuity.' };
  }

  const sorted = [...seqs].sort((a, b) => a - b);
  let maxObserved = 0;
  let gapAt = null;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > maxObserved) {
      maxObserved = gap;
      gapAt = sorted[i - 1];
    }
  }

  if (maxObserved > maxGap) {
    return {
      status: 'fail',
      detail: `Sequence gap of ${maxObserved} detected after seq #${gapAt}. May indicate dropped messages or a ring buffer rollover.`
    };
  }

  return {
    status: 'pass',
    detail: `Largest gap in ${sorted.length} messages is ${maxObserved} — within expected range.`
  };
}

/**
 * Probe 2: Message Framing
 * Every Technocore message should have at minimum a seq number and text.
 * A high rate of malformed messages suggests a parsing or upstream issue.
 *
 * @param {object[]} messages
 * @returns {{ status: 'pass'|'fail'|'skipped', detail: string }}
 */
export function probeMessageFraming(messages) {
  if (!messages || messages.length === 0) {
    return { status: 'skipped', detail: 'No messages to evaluate.' };
  }

  const malformed = messages.filter(m => !m.seq || (m.text === undefined && m.rawText === undefined));
  const rate = malformed.length / messages.length;

  if (rate > 0.05) {
    return {
      status: 'fail',
      detail: `${malformed.length}/${messages.length} messages (${(rate * 100).toFixed(1)}%) are missing required fields (seq or text).`
    };
  }

  return {
    status: 'pass',
    detail: `All ${messages.length} messages have required fields. Framing is intact.`
  };
}

/**
 * Probe 3: Signature Coverage
 * Checks what fraction of messages carry a did:key signature.
 * Not a failure if low — just a diagnostic signal.
 *
 * @param {object[]} messages
 * @returns {{ status: 'pass'|'fail'|'skipped', detail: string }}
 */
export function probeSignatureCoverage(messages) {
  if (!messages || messages.length === 0) {
    return { status: 'skipped', detail: 'No messages to evaluate.' };
  }

  const signed = messages.filter(m => m.from && m.from.startsWith('did:key:z6Mk'));
  const coverage = signed.length / messages.length;
  const pct = (coverage * 100).toFixed(1);

  // Not a pass/fail — always pass; detail carries the diagnostic value
  return {
    status: 'pass',
    detail: `${signed.length}/${messages.length} messages (${pct}%) carry a did:key signature.`
  };
}

/**
 * Probe 4: Velocity Sanity
 * Flags if the room has received zero new messages since the last poll window.
 * Stalling on a normally active room (e.g. lobby) may indicate upstream issues.
 *
 * @param {number} newMessagesSinceLastPoll
 * @param {string} room
 * @returns {{ status: 'pass'|'fail'|'skipped', detail: string }}
 */
export function probeVelocitySanity(newMessagesSinceLastPoll, room) {
  if (newMessagesSinceLastPoll === null || newMessagesSinceLastPoll === undefined) {
    return { status: 'skipped', detail: 'No polling data available yet.' };
  }

  if (newMessagesSinceLastPoll === 0 && room === 'lobby') {
    return {
      status: 'fail',
      detail: `Zero new messages received from /r/lobby in the last poll window. Upstream may be stalling.`
    };
  }

  return {
    status: 'pass',
    detail: `Received ${newMessagesSinceLastPoll} new message(s) in the last poll window.`
  };
}

/**
 * Probe 5: DID Format Integrity
 * Validates that all signed messages use the expected did:key:z6Mk Ed25519 format.
 * Other prefixes may indicate a schema change or malformed entries.
 *
 * @param {object[]} messages
 * @returns {{ status: 'pass'|'fail'|'skipped', detail: string }}
 */
export function probeDidFormat(messages) {
  if (!messages || messages.length === 0) {
    return { status: 'skipped', detail: 'No messages to evaluate.' };
  }

  const signed = messages.filter(m => m.from && m.from.startsWith('did:'));
  if (signed.length === 0) {
    return { status: 'skipped', detail: 'No signed messages in current window.' };
  }

  const malformedDids = signed.filter(m => !m.from.startsWith('did:key:z6Mk'));

  if (malformedDids.length > 0) {
    return {
      status: 'fail',
      detail: `${malformedDids.length} message(s) have DIDs that do not follow the did:key:z6Mk Ed25519 format.`
    };
  }

  return {
    status: 'pass',
    detail: `All ${signed.length} signed message(s) use the expected did:key:z6Mk format.`
  };
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

/**
 * Run all probes against the current message window.
 * This is the main entry point called by api.js / app.js.
 *
 * @param {object} params
 * @param {object[]} params.messages - Current state.messages snapshot
 * @param {string}   params.room     - Current room name
 * @param {number}   params.newMessagesSinceLastPoll
 * @returns {import('./store.js').ProtocolHealth}
 */
export function runProbes({ messages = [], room = '', newMessagesSinceLastPoll = null } = {}) {
  const seqs = messages.map(m => m.seq).filter(Boolean);

  const probes = [
    { name: 'sequence-continuity', ...probeSequenceContinuity(seqs) },
    { name: 'message-framing',     ...probeMessageFraming(messages) },
    { name: 'signature-coverage',  ...probeSignatureCoverage(messages) },
    { name: 'velocity-sanity',     ...probeVelocitySanity(newMessagesSinceLastPoll, room) },
    { name: 'did-format',          ...probeDidFormat(messages) },
  ];

  const failCount = probes.filter(p => p.status === 'fail').length;
  const status = failCount >= 2 ? 'degraded' : failCount === 1 ? 'degraded' : 'ok';

  return {
    status,
    lastRun: Date.now(),
    room,
    probes,
  };
}
