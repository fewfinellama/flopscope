import { state } from './store.js';
import { isBoilerplate } from './farming-patterns.js';

export const DID_ANALYZER_VERSION = '1.0.0';
const MAX_DID_CACHE = 5000;

export function analyzeDids(room, messages) {
  if (!state.didStats) {
    state.didStats = new Map();
  }

  const now = Date.now();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const did = msg.from || msg.did;
    
    // Only track signed did:key
    if (!did || !did.startsWith('did:key:')) continue;

    let stats = state.didStats.get(did);
    if (!stats) {
      stats = {
        did,
        firstSeen: now,
        lastSeen: now,
        messageCount: 0,
        rooms: new Set(),
        replyCountReceived: 0,
        originalityScore: 1.0,
        flags: new Set(),
        sampleTexts: []
      };
      state.didStats.set(did, stats);
    }

    // Update basic stats
    stats.lastSeen = now;
    stats.messageCount++;
    stats.rooms.add(room);
    
    const text = msg.text || '';
    
    // Originality tracking (simple heuristic for now)
    if (text.trim().length > 0) {
      stats.sampleTexts.push(text);
      if (stats.sampleTexts.length > 5) {
        stats.sampleTexts.shift(); // keep last 5
      }
      
      if (isBoilerplate(text)) {
        // Penalty for boilerplate
        stats.originalityScore = Math.max(0, stats.originalityScore - 0.2);
      } else if (text.length > 30) {
        // Reward for longer unique text
        stats.originalityScore = Math.min(1.0, stats.originalityScore + 0.1);
      }
    }

    // Reciprocity detection (Did someone reply to them in this batch?)
    // In a realtime stream, we'd check if this message references someone else
    const mentions = [...text.matchAll(/did:key:[A-Za-z0-9]+/g)].map(m => m[0]);
    for (const mentionedDid of mentions) {
      if (mentionedDid !== did && state.didStats.has(mentionedDid)) {
        const mentionedStats = state.didStats.get(mentionedDid);
        mentionedStats.replyCountReceived++;
      }
    }
  }

  // Second pass to derive flags
  for (const stats of state.didStats.values()) {
    stats.flags.clear();
    
    const ageMs = now - stats.firstSeen;
    
    if (stats.messageCount === 1 && ageMs > 30 * 60 * 1000) {
      stats.flags.add('one-shot');
    }
    
    if (stats.originalityScore <= 0.3) {
      stats.flags.add('template-heavy');
    }
    
    if (stats.replyCountReceived >= 3) {
      stats.flags.add('high-reciprocity');
    }
    
    if (stats.originalityScore <= 0.2 && stats.messageCount > 10 && stats.replyCountReceived === 0) {
      stats.flags.add('suspicious');
    }
  }

  // LRU Eviction (Naive approach using Map insertion order)
  while (state.didStats.size > MAX_DID_CACHE) {
    const firstKey = state.didStats.keys().next().value;
    state.didStats.delete(firstKey);
  }
}
