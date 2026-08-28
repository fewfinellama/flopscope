import { state, el } from './store.js';

export function openHealthModal() {
  const metrics = state.roomMetrics[state.currentRoom];
  if (!metrics) return;

  // Re-use proof inspector modal container since it's just a general modal
  if (!el.modalOverlay || !el.modalContainer) return;

  const b = metrics.breakdown;

  el.modalContainer.innerHTML = `
    <div class="p-6 space-y-6 text-slate-800 dark:text-slate-200">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <h3 class="text-lg font-bold font-mono text-slate-900 dark:text-white flex items-center gap-2">
          <span>Signal Health Methodology</span>
          <span class="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-mono">v1.0.0</span>
        </h3>
        <button id="modal-close-btn" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="text-center py-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80">
        <div class="text-xs text-slate-500 font-mono font-bold uppercase tracking-wider mb-2">/r/${escapeHtml(metrics.room)} Health Score</div>
        <div class="text-5xl font-bold font-mono text-violet-600 dark:text-violet-400">${metrics.healthScore}<span class="text-xl text-slate-400">%</span></div>
      </div>

      <div class="space-y-3 font-mono text-xs">
        <div class="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <span class="text-slate-600 dark:text-slate-400">Base Score</span>
          <span class="font-bold">0</span>
        </div>
        <div class="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div>
            <span class="text-slate-600 dark:text-slate-400 block">Spam Resistance (35 max)</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">Penalizes regex boilerplates</span>
          </div>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">+${b.spamPenalty}</span>
        </div>
        <div class="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div>
            <span class="text-slate-600 dark:text-slate-400 block">Signal Density (25 max)</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">Rewards meaningful lengths & URLs</span>
          </div>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">+${b.signalBonus}</span>
        </div>
        <div class="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div>
            <span class="text-slate-600 dark:text-slate-400 block">Identity Distribution (20 max)</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">Herfindahl-Hirschman Index</span>
          </div>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">+${b.concentrationPenalty}</span>
        </div>
        <div class="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div>
            <span class="text-slate-600 dark:text-slate-400 block">Reciprocity (15 max)</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">Cross-DID references & replies</span>
          </div>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">+${b.reciprocityBonus}</span>
        </div>
        <div class="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div>
            <span class="text-slate-600 dark:text-slate-400 block">Identity Persistence (5 max)</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">DIDs appearing >= 2 times</span>
          </div>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">+${b.persistenceBonus}</span>
        </div>
      </div>
    </div>
  `;

  el.modalOverlay.classList.remove('hidden');
  el.modalOverlay.classList.add('flex');

  document.getElementById('modal-close-btn').onclick = () => {
    el.modalOverlay.classList.add('hidden');
    el.modalOverlay.classList.remove('flex');
  };
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
