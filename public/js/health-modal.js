import { state, el } from './store.js';

export function openHealthModal() {
  const metrics = state.roomMetrics[state.currentRoom];
  if (!metrics) return;

  if (!el.modalOverlay || !el.modalContainer) return;

  const b = metrics.breakdown;
  let grade = 'C';
  let gradeColor = 'text-amber-600 dark:text-amber-400';
  let gradeBg = 'bg-amber-50 dark:bg-amber-950/30';
  let gradeBorder = 'border-amber-200 dark:border-amber-800/60';
  
  if (metrics.healthScore >= 80) {
    grade = 'A';
    gradeColor = 'text-emerald-600 dark:text-emerald-400';
    gradeBg = 'bg-emerald-50 dark:bg-emerald-950/30';
    gradeBorder = 'border-emerald-200 dark:border-emerald-800/60';
  } else if (metrics.healthScore < 50) {
    grade = 'F';
    gradeColor = 'text-rose-600 dark:text-rose-400';
    gradeBg = 'bg-rose-50 dark:bg-rose-950/30';
    gradeBorder = 'border-rose-200 dark:border-rose-800/60';
  } else if (metrics.healthScore >= 65) {
    grade = 'B';
    gradeColor = 'text-lime-600 dark:text-lime-400';
    gradeBg = 'bg-lime-50 dark:bg-lime-950/30';
    gradeBorder = 'border-lime-200 dark:border-lime-800/60';
  }

  el.modalContainer.innerHTML = `
    <div class="p-6 space-y-6 text-slate-800 dark:text-slate-200">
      
      <!-- Standard Header -->
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <h3 class="text-lg font-bold font-mono text-slate-900 dark:text-white flex items-center gap-2">
          <span>Diagnostic Report</span>
          <span class="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-mono">/r/${escapeHtml(metrics.room)}</span>
        </h3>
        <button id="modal-close-btn" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Health Hero Box -->
      <div class="relative overflow-hidden glass-panel rounded-2xl p-4 sm:p-5 flex items-center gap-4 sm:gap-6 border-l-4 ${gradeBorder.replace('border-', 'border-l-')}">
        <!-- Background Glow -->
        <div class="absolute -left-10 -top-10 w-40 h-40 rounded-full opacity-20 blur-3xl ${gradeBg}"></div>
        
        <!-- Circular Donut Chart -->
        <div class="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path class="text-slate-200 dark:text-slate-800/80" stroke-width="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="${gradeColor}" stroke-dasharray="${metrics.healthScore}, 100" stroke-width="3.5" stroke="currentColor" fill="none" stroke-linecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <div class="absolute inset-0 flex items-center justify-center flex-col pt-0.5">
            <span class="text-lg sm:text-2xl font-bold font-mono ${gradeColor}">${metrics.healthScore}</span>
          </div>
        </div>
        
        <div class="flex-1 space-y-1.5 z-10 min-w-0">
           <div class="flex items-center gap-2.5 flex-wrap">
              <h4 class="text-base sm:text-lg font-bold uppercase tracking-wider ${gradeColor}">Grade ${grade}</h4>
              <span class="px-2 py-0.5 rounded text-[10px] sm:text-xs font-mono font-bold border ${gradeBg} ${gradeColor} ${gradeBorder}">Signal Score</span>
           </div>
           <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-sans leading-relaxed pr-2">
             Based on cryptographic verification, spam density, and unique identity contribution over <span class="font-mono text-slate-700 dark:text-slate-300">${metrics.sampleSize}</span> recent messages.
           </p>
        </div>
      </div>

      <!-- Detail Breakdown -->
      <div class="space-y-3 font-mono text-xs">
        <!-- Penalty Category -->
        <h4 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-4 mb-2">Penalties Applied</h4>
        
        <div class="p-3.5 rounded-xl glass-panel shadow-sm flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <span class="block text-slate-800 dark:text-slate-200 font-bold truncate">Bot Boilerplate</span>
            <span class="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Automated regex spam & noise</span>
          </div>
          <span class="font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">-${35 - b.spamPenalty} pts</span>
        </div>

        <div class="p-3.5 rounded-xl glass-panel shadow-sm flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <span class="block text-slate-800 dark:text-slate-200 font-bold truncate">Sybil Monopoly</span>
            <span class="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Herfindahl index > 0.1</span>
          </div>
          <span class="font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">-${20 - b.concentrationPenalty} pts</span>
        </div>

        <!-- Bonus Category -->
        <h4 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-4 mb-2">Contributions Earned</h4>

        <div class="p-3.5 rounded-xl glass-panel shadow-sm flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <span class="block text-slate-800 dark:text-slate-200 font-bold truncate">Signal Density</span>
            <span class="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Meaningful text lengths & URLs</span>
          </div>
          <span class="font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">+${b.signalBonus} pts</span>
        </div>

        <div class="p-3.5 rounded-xl glass-panel shadow-sm flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <span class="block text-slate-800 dark:text-slate-200 font-bold truncate">Reciprocity</span>
            <span class="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Cross-DID interactions detected</span>
          </div>
          <span class="font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">+${b.reciprocityBonus} pts</span>
        </div>

        <div class="p-3.5 rounded-xl glass-panel shadow-sm flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <span class="block text-slate-800 dark:text-slate-200 font-bold truncate">Identity Persistence</span>
            <span class="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">DIDs retained across window</span>
          </div>
          <span class="font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">+${b.persistenceBonus} pts</span>
        </div>
      </div>

      <!-- Trust Footer -->
      <div class="text-center pt-2">
        <p class="text-[10px] text-slate-400 dark:text-slate-500 font-sans flex items-center justify-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          Deterministically calculated in-browser. Zero-trust maintained.
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
