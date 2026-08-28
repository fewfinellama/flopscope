import { state, el } from './store.js';

export function openHealthModal() {
  const metrics = state.roomMetrics[state.currentRoom];
  if (!metrics) return;

  if (!el.modalOverlay || !el.modalContainer) return;

  const b = metrics.breakdown;
  let grade = 'C';
  let gradeColor = 'text-amber-500';
  let gaugeColor = 'stroke-amber-500';
  
  if (metrics.healthScore >= 80) {
    grade = 'A';
    gradeColor = 'text-emerald-500';
    gaugeColor = 'stroke-emerald-500';
  } else if (metrics.healthScore < 50) {
    grade = 'F';
    gradeColor = 'text-rose-500';
    gaugeColor = 'stroke-rose-500';
  } else if (metrics.healthScore >= 65) {
    grade = 'B';
    gradeColor = 'text-lime-500';
    gaugeColor = 'stroke-lime-500';
  }

  // SVG Gauge Math (Circle length ~251)
  const offset = 251 - (251 * metrics.healthScore) / 100;

  el.modalContainer.innerHTML = `
    <div class="relative overflow-hidden text-slate-800 dark:text-slate-200">
      
      <!-- Premium Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/60">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <h3 class="text-lg font-bold font-mono text-slate-900 dark:text-white leading-tight">Diagnostic Report</h3>
            <p class="text-xs text-slate-500 font-mono mt-0.5">/r/${escapeHtml(metrics.room)} · Sample: ${metrics.sampleSize} msgs</p>
          </div>
        </div>
        <button id="modal-close-btn" class="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-white dark:bg-slate-800 rounded-full p-1.5 shadow-sm border border-slate-200 dark:border-slate-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="p-6 space-y-8">
        
        <!-- Hero Score Section -->
        <div class="flex items-center justify-center gap-8 py-4">
          <div class="relative w-32 h-32 flex items-center justify-center">
            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" class="stroke-slate-200 dark:stroke-slate-800" stroke-width="8" fill="none" />
              <circle cx="50" cy="50" r="40" class="${gaugeColor} transition-all duration-1000 ease-out" stroke-width="8" fill="none" stroke-dasharray="251.2" stroke-dashoffset="${offset}" stroke-linecap="round" />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-4xl font-extrabold font-mono ${gradeColor}">${metrics.healthScore}</span>
            </div>
          </div>
          <div class="space-y-2">
            <h4 class="text-3xl font-bold ${gradeColor} tracking-tight">Grade ${grade}</h4>
            <p class="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] leading-relaxed">
              Based on cryptographic verification, spam density, and unique identity contribution.
            </p>
          </div>
        </div>

        <!-- Breakdown Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-sm">
          
          <!-- Penalties Column -->
          <div class="space-y-3">
            <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">Penalties</h5>
            
            <div class="flex justify-between items-start">
              <div class="flex gap-2">
                <svg class="w-4 h-4 text-rose-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <div>
                  <span class="block text-slate-700 dark:text-slate-300 font-bold">Bot Boilerplate</span>
                  <span class="block text-[10px] text-slate-500">Automated regex spam</span>
                </div>
              </div>
              <span class="font-bold text-rose-600 dark:text-rose-400">-${35 - b.spamPenalty}</span>
            </div>

            <div class="flex justify-between items-start">
              <div class="flex gap-2">
                <svg class="w-4 h-4 text-rose-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                <div>
                  <span class="block text-slate-700 dark:text-slate-300 font-bold">Sybil Monopoly</span>
                  <span class="block text-[10px] text-slate-500">Herfindahl index > 0.1</span>
                </div>
              </div>
              <span class="font-bold text-rose-600 dark:text-rose-400">-${20 - b.concentrationPenalty}</span>
            </div>
          </div>

          <!-- Bonuses Column -->
          <div class="space-y-3">
            <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">Contributions</h5>
            
            <div class="flex justify-between items-start">
              <div class="flex gap-2">
                <svg class="w-4 h-4 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <div>
                  <span class="block text-slate-700 dark:text-slate-300 font-bold">Signal Density</span>
                  <span class="block text-[10px] text-slate-500">Meaningful length & URLs</span>
                </div>
              </div>
              <span class="font-bold text-emerald-600 dark:text-emerald-400">+${b.signalBonus}</span>
            </div>

            <div class="flex justify-between items-start">
              <div class="flex gap-2">
                <svg class="w-4 h-4 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                <div>
                  <span class="block text-slate-700 dark:text-slate-300 font-bold">Reciprocity</span>
                  <span class="block text-[10px] text-slate-500">Cross-DID interactions</span>
                </div>
              </div>
              <span class="font-bold text-emerald-600 dark:text-emerald-400">+${b.reciprocityBonus}</span>
            </div>

            <div class="flex justify-between items-start">
              <div class="flex gap-2">
                <svg class="w-4 h-4 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                <div>
                  <span class="block text-slate-700 dark:text-slate-300 font-bold">Identity Persistence</span>
                  <span class="block text-[10px] text-slate-500">DIDs retained in window</span>
                </div>
              </div>
              <span class="font-bold text-emerald-600 dark:text-emerald-400">+${b.persistenceBonus}</span>
            </div>
          </div>

        </div>

      </div>

      <!-- Footer Info -->
      <div class="bg-slate-100 dark:bg-slate-900/80 p-4 text-center border-t border-slate-200 dark:border-slate-800">
        <p class="text-[10px] sm:text-xs text-slate-500 font-sans flex items-center justify-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          Deterministically calculated in your browser. Zero-trust maintained.
        </p>
      </div>
    </div>
  `;

  el.modalOverlay.classList.remove('hidden');
  el.modalOverlay.classList.add('flex');

  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      el.modalOverlay.classList.add('hidden');
      el.modalOverlay.classList.remove('flex');
    };
  }
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
