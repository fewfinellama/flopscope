import { isBoilerplate } from './farming-patterns.js';

export const HEALTH_SCORER_VERSION = '1.0.0';

export function computeRoomHealth(room, messages) {
  if (!messages || messages.length === 0) {
    return _emptyMetrics(room);
  }

  const sampleSize = messages.length;
  let spamCount = 0;
  let signalCount = 0;
  let reciprocityCount = 0;
  const didCounts = new Map();

  // URL extraction regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const didRegex = /did:key:[A-Za-z0-9]+/g;

  // Track sequences to detect replies
  const seqs = new Set(messages.map(m => m.seq));

  for (let i = 0; i < sampleSize; i++) {
    const msg = messages[i];
    const text = msg.text || '';
    const senderDid = msg.from || msg.did;
    
    // Track author concentration
    if (senderDid) {
      didCounts.set(senderDid, (didCounts.get(senderDid) || 0) + 1);
    }

    // Boilerplate check
    const isSpam = isBoilerplate(text);
    if (isSpam) {
      spamCount++;
    } else {
      // Signal check (meaningful length or external link)
      const hasLink = urlRegex.test(text);
      const cleanText = text.replace(urlRegex, '').replace(didRegex, '').trim();
      if (cleanText.length > 50 || hasLink) {
        signalCount++;
      }
    }

    // Reciprocity heuristic: Does this message reference another DID or a recent sequence number?
    // In a real reply tree we'd check if someone replies *to* this.
    // For this snapshot, if the message mentions another DID, it's reciprocal.
    const mentions = [...text.matchAll(didRegex)].map(m => m[0]);
    const mentionsOthers = mentions.some(mDid => mDid !== senderDid);
    const mentionsSeq = text.includes('#') && Array.from(seqs).some(s => text.includes('#' + s));
    
    if (mentionsOthers || mentionsSeq) {
      reciprocityCount++;
    }
  }

  // Calculate author concentration (Herfindahl-Hirschman Index)
  let hhi = 0;
  let uniquePersistentDids = 0;
  
  for (const count of didCounts.values()) {
    const share = count / sampleSize;
    hhi += (share * share);
    if (count >= 2) {
      uniquePersistentDids++;
    }
  }

  const spamShare = spamCount / sampleSize;
  const signalShare = signalCount / sampleSize;
  const authorConcentration = hhi; // 0 (perfectly distributed) to 1 (monopoly)
  const reciprocity = reciprocityCount / sampleSize;

  let healthScore = 
    35 * (1 - spamShare) +
    25 * signalShare +
    20 * (1 - authorConcentration) +
    15 * reciprocity +
    5  * Math.min(1, uniquePersistentDids / 20);

  // Clamp 0-100
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  return {
    room,
    sampleSize,
    spamShare,
    signalShare,
    authorConcentration,
    reciprocity,
    uniquePersistentDids,
    uniqueDids: didCounts.size,
    healthScore,
    lastComputed: Date.now(),
    breakdown: {
      spamPenalty: Math.round(35 * spamShare), // What they lost
      signalBonus: Math.round(25 * signalShare), // What they gained
      concentrationPenalty: Math.round(20 * authorConcentration),
      reciprocityBonus: Math.round(15 * reciprocity),
      persistenceBonus: Math.round(5 * Math.min(1, uniquePersistentDids / 20))
    }
  };
}

function _emptyMetrics(room) {
  return {
    room,
    sampleSize: 0,
    spamShare: 0,
    signalShare: 0,
    authorConcentration: 0,
    reciprocity: 0,
    uniquePersistentDids: 0,
    uniqueDids: 0,
    healthScore: 0,
    lastComputed: Date.now(),
    breakdown: {
      spamPenalty: 0,
      signalBonus: 0,
      concentrationPenalty: 0,
      reciprocityBonus: 0,
      persistenceBonus: 0
    }
  };
}
