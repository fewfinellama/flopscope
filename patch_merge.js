import fs from 'fs';
let api = fs.readFileSync('public/js/api.js', 'utf8');

const oldMerge = `export function mergeMessages(newBatch) {
  const existingMap = new Map();
  for (const m of state.messages) {
    existingMap.set(m.seq, m);
  }
  for (const m of newBatch) {
    if (m && m.seq !== undefined) {
      existingMap.set(m.seq, m);
    }
  }
  state.messages = Array.from(existingMap.values());
}`;

const newMerge = `export function mergeMessages(newBatch) {
  const existingMap = new Map();
  for (const m of state.messages) {
    existingMap.set(m.seq, m);
  }
  for (const m of newBatch) {
    if (m && m.seq !== undefined) {
      existingMap.set(m.seq, m);
    }
  }
  
  // Sort descending by sequence number and cap at 1000 to prevent OOM
  const merged = Array.from(existingMap.values());
  merged.sort((a, b) => b.seq - a.seq);
  
  // Cap at 1000 messages (Performance tuning for high-velocity rooms)
  if (merged.length > 1000) {
    merged.length = 1000;
  }
  
  state.messages = merged;
}`;

api = api.replace(oldMerge, newMerge);
fs.writeFileSync('public/js/api.js', api);
