import { state } from './store.js';

const MAX_SNAPSHOTS_PER_ROOM = 100; // Keep up to 100 historical points per room
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // Save max one snapshot per 5 minutes

export function saveRoomSnapshot(roomMetrics) {
  if (!roomMetrics || !roomMetrics.room) return;
  const room = roomMetrics.room;
  
  if (!state.snapshots) state.snapshots = {};
  
  if (!state.snapshots[room]) {
    const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem(`flopscope_snapshots_${room}`) : null;
    state.snapshots[room] = stored ? JSON.parse(stored) : [];
  }
  
  const roomHistory = state.snapshots[room];
  const now = Date.now();
  
  if (roomHistory.length > 0) {
    const lastSnap = roomHistory[roomHistory.length - 1];
    if (now - lastSnap.ts < SNAPSHOT_INTERVAL_MS) {
      return; // Throttled
    }
  }
  
  roomHistory.push({
    ts: now,
    healthScore: roomMetrics.healthScore,
    spamShare: roomMetrics.spamShare,
    uniqueDids: roomMetrics.uniqueDids
  });
  
  if (roomHistory.length > MAX_SNAPSHOTS_PER_ROOM) {
    roomHistory.splice(0, roomHistory.length - MAX_SNAPSHOTS_PER_ROOM);
  }
  
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`flopscope_snapshots_${room}`, JSON.stringify(roomHistory));
  }
}

export function getRoomSnapshots(room) {
  if (!state.snapshots) state.snapshots = {};
  if (!state.snapshots[room]) {
    const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem(`flopscope_snapshots_${room}`) : null;
    state.snapshots[room] = stored ? JSON.parse(stored) : [];
  }
  return state.snapshots[room];
}

export function generateSparklineSvg(snapshots, width = 60, height = 24, colorClass = "text-emerald-500") {
  if (!snapshots || snapshots.length < 2) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="opacity-30"><line x1="0" y1="${height/2}" x2="${width}" y2="${height/2}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2" /></svg>`;
  }
  
  const maxPoints = Math.min(snapshots.length, 50); // display up to 50 points
  const data = snapshots.slice(-maxPoints);
  
  const dx = width / (maxPoints - 1);
  const points = data.map((snap, i) => {
    const x = i * dx;
    const padding = 3;
    const y = padding + ((100 - snap.healthScore) / 100) * (height - 2*padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="${colorClass} overflow-visible" fill="none">
      <polyline points="${points}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}
