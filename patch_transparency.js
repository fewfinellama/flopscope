import fs from 'fs';
let api = fs.readFileSync('public/js/api.js', 'utf8');

// We need to replace the body of openHealthTransparencyModal.
const startStr = "export function openHealthTransparencyModal() {";
const startIndex = api.indexOf(startStr);
if (startIndex === -1) process.exit(1);

// Find the end of the function.
let braceCount = 0;
let endIndex = -1;
for (let i = startIndex + startStr.length - 1; i < api.length; i++) {
  if (api[i] === '{') braceCount++;
  if (api[i] === '}') {
    braceCount--;
    if (braceCount === 0) {
      endIndex = i;
      break;
    }
  }
}

const replacement = `export function openHealthTransparencyModal() {
  const metrics = state.roomMetrics[state.currentRoom];
  if (!metrics) return;

  const overallStatus = metrics.sampleSize < 10 ? 'ANALYZING' : (metrics.healthScore >= 80 ? 'EXCELLENT' : (metrics.healthScore >= 50 ? 'MODERATE' : 'POOR'));
  
  const overallColor = overallStatus === 'EXCELLENT'
    ? 'text-emerald-600 dark:text-emerald-400'
    : overallStatus === 'MODERATE'
    ? 'text-amber-600 dark:text-amber-400'
    : overallStatus === 'POOR'
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-slate-500';

  const lastRunText = metrics.lastComputed
    ? \`Computed \${Math.round((Date.now() - metrics.lastComputed) / 1000)}s ago\`
    : 'Not yet run';

  const formatRow = (name, statusText, statusType, detail) => {
    const icon = statusType === 'pass'
      ? \`<svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>\`
      : statusType === 'fail'
      ? \`<svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>\`
      : \`<svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01"/></svg>\`;

    const statusColor = statusType === 'pass'
      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
      : statusType === 'fail'
      ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
      : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800';

    const pillClass = statusType === 'pass' 
      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400' 
      : statusType === 'fail' 
      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400' 
      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

    return \`
      <div class="p-3 rounded-xl border \${statusColor} space-y-1">
        <div class="flex items-center gap-2">
          \${icon}
          <span class="font-mono font-bold text-xs tracking-wide uppercase">\${name}</span>
          <span class="ml-auto text-xs font-bold font-mono px-2 py-0.5 rounded-full \${pillClass}">\${statusText}</span>
        </div>
        <p class="text-xs leading-relaxed pl-6 text-slate-600 dark:text-slate-400 font-sans">\${detail}</p>
      </div>\`;
  };

  const rows = [
    formatRow('Spam Penalty', \`-\${metrics.breakdown.spamPenalty || 0} / 35\`, metrics.breakdown.spamPenalty > 15 ? 'fail' : 'pass', \`\${Math.round(metrics.spamShare*100)}% of messages matched known farming patterns.\`),
    formatRow('Signal Bonus', \`+\${metrics.breakdown.signalBonus || 0} / 25\`, metrics.breakdown.signalBonus >= 10 ? 'pass' : 'fail', \`\${Math.round(metrics.signalShare*100)}% of messages had meaningful length or external links.\`),
    formatRow('Concentration', \`-\${metrics.breakdown.concentrationPenalty || 0} / 20\`, metrics.breakdown.concentrationPenalty > 10 ? 'fail' : 'pass', \`HHI is \${metrics.authorConcentration.toFixed(2)}. Higher means fewer DIDs dominate the room.\`),
    formatRow('Reciprocity', \`+\${metrics.breakdown.reciprocityBonus || 0} / 15\`, metrics.breakdown.reciprocityBonus > 0 ? 'pass' : 'fail', \`\${Math.round(metrics.reciprocity*100)}% of messages were replied to by others.\`),
    formatRow('Persistence', \`+\${metrics.breakdown.persistenceBonus || 0} / 5\`, metrics.breakdown.persistenceBonus > 0 ? 'pass' : 'fail', \`\${metrics.uniquePersistentDids} DIDs sent multiple messages in this window.\`)
  ].join('');

  el.modalContainer.innerHTML = \`
    <div class="p-5 sm:p-6 space-y-5 text-slate-800 dark:text-slate-200">

      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 \${overallColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 class="text-base font-bold text-slate-900 dark:text-white tracking-tight">Room Health Diagnostic</h3>
        </div>
        <button id="modal-close-btn" class="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 transition-colors rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">\${lastRunText} (Sample size: \${metrics.sampleSize})</p>
          <p class="text-lg font-bold font-mono \${overallColor} mt-0.5">Score: \${metrics.healthScore}% · \${overallStatus}</p>
        </div>
      </div>

      <div class="space-y-2.5">
        <h4 class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Formula Breakdown</h4>
        \${rows}
      </div>

      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-sans text-center pt-2">
        The Health Score is a read-only, client-side diagnostic signal, not a moral judgment.
      </p>
    </div>
  \`;

  el.modalOverlay.classList.remove('hidden');
  el.modalOverlay.classList.add('flex');

  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) closeBtn.onclick = () => { import('./ui.js').then(m => m.closeModal()); };
}`;

api = api.substring(0, startIndex) + replacement + api.substring(endIndex + 1);
fs.writeFileSync('public/js/api.js', api);
