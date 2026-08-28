import fs from 'fs';
const code = `
export function openHealthTransparencyModal() {
  const metrics = state.roomMetrics[state.currentRoom];
  if (!metrics) return;

  const titleColor = metrics.healthScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' 
    : metrics.healthScore >= 50 ? 'text-amber-600 dark:text-amber-400' 
    : 'text-rose-600 dark:text-rose-400';

  el.modalContainer.innerHTML = \`
    <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
      <h3 class="text-base font-bold font-mono text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <svg class="w-5 h-5 \${titleColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        Room Health Scoring (v1)
      </h3>
      <button id="modal-close-btn" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors p-1 rounded-lg">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    
    <div class="p-4 sm:p-5 overflow-y-auto max-h-[80vh] space-y-6">
      
      <div class="bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center">
        <div class="text-sm font-mono text-slate-500 dark:text-slate-400 mb-1">Current Health Score</div>
        <div class="text-5xl font-bold font-mono \${titleColor}">\${metrics.sampleSize < 10 ? '--' : metrics.healthScore}</div>
        <div class="text-xs font-mono text-slate-500 dark:text-slate-400 mt-2">Based on the last \${metrics.sampleSize} messages</div>
      </div>
      
      <div class="space-y-3">
        <h4 class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Formula Breakdown</h4>
        <div class="bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 text-sm font-mono">
          
          <div class="flex items-center justify-between p-3">
            <div class="text-slate-700 dark:text-slate-300">
              <span class="font-bold">Spam Penalty</span> (Max 35)
              <div class="text-[10px] text-slate-500 font-sans mt-0.5">\${Math.round(metrics.spamShare*100)}% of messages matched farming patterns</div>
            </div>
            <div class="font-bold text-rose-500 dark:text-rose-400">-\${metrics.breakdown.spamPenalty || 0}</div>
          </div>
          
          <div class="flex items-center justify-between p-3">
            <div class="text-slate-700 dark:text-slate-300">
              <span class="font-bold">Signal Bonus</span> (Max 25)
              <div class="text-[10px] text-slate-500 font-sans mt-0.5">\${Math.round(metrics.signalShare*100)}% had meaningful length or links</div>
            </div>
            <div class="font-bold text-emerald-500 dark:text-emerald-400">+\${metrics.breakdown.signalBonus || 0}</div>
          </div>
          
          <div class="flex items-center justify-between p-3">
            <div class="text-slate-700 dark:text-slate-300">
              <span class="font-bold">Concentration Penalty</span> (Max 20)
              <div class="text-[10px] text-slate-500 font-sans mt-0.5">Herfindahl Index: \${metrics.authorConcentration.toFixed(2)} (1.0 = single author)</div>
            </div>
            <div class="font-bold text-amber-500 dark:text-amber-400">-\${metrics.breakdown.concentrationPenalty || 0}</div>
          </div>
          
          <div class="flex items-center justify-between p-3">
            <div class="text-slate-700 dark:text-slate-300">
              <span class="font-bold">Reciprocity Bonus</span> (Max 15)
              <div class="text-[10px] text-slate-500 font-sans mt-0.5">\${Math.round(metrics.reciprocity*100)}% of messages were replied to</div>
            </div>
            <div class="font-bold text-emerald-500 dark:text-emerald-400">+\${metrics.breakdown.reciprocityBonus || 0}</div>
          </div>
          
          <div class="flex items-center justify-between p-3">
            <div class="text-slate-700 dark:text-slate-300">
              <span class="font-bold">Persistence Bonus</span> (Max 5)
              <div class="text-[10px] text-slate-500 font-sans mt-0.5">\${metrics.uniquePersistentDids} DIDs with >= 2 messages</div>
            </div>
            <div class="font-bold text-emerald-500 dark:text-emerald-400">+\${metrics.breakdown.persistenceBonus || 0}</div>
          </div>
          
        </div>
      </div>
      
      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-sans text-center">
        The Health Score is a read-only diagnostic signal, not a moral judgment.
      </p>
    </div>
  \`;

  el.modalOverlay.classList.remove('hidden');
  el.modalOverlay.classList.add('flex');
  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) closeBtn.onclick = () => { import('./ui.js').then(m => m.closeModal()); };
}
`;
let api = fs.readFileSync('public/js/api.js', 'utf8');
api = api + '\n' + code;
fs.writeFileSync('public/js/api.js', api);
