import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');

// The old modal HTML starts with <!-- COMPARE ROOMS MODAL -->
// and ends with </div>\n  </div>
const oldModalRegex = /<!-- COMPARE ROOMS MODAL -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newModalHtml = `<!-- COMPARE ROOMS MODAL -->
  <div id="compare-modal-overlay" class="overlay-enter fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm hidden items-center justify-center p-4 sm:p-6">
    <div class="glass-panel modal-enter w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      
      <!-- Header -->
      <div class="px-6 py-5 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/50 flex items-center justify-center text-cyan-600 dark:text-[#00c2ff] border border-cyan-200 dark:border-cyan-900/50">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <div>
            <h2 class="text-lg font-bold font-mono text-slate-900 dark:text-white tracking-tight">Room Comparison</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">A/B test the signal quality of two rooms</p>
          </div>
        </div>
        <button id="close-compare-btn" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto">
        
        <!-- Room Selectors -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div class="space-y-1.5">
            <label class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Room A</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">/r/</span>
              <input type="text" id="compare-room-a" class="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none" placeholder="lobby" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Room B</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">/r/</span>
              <input type="text" id="compare-room-b" class="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none" placeholder="alerts" />
            </div>
          </div>
        </div>

        <button id="run-compare-btn" class="w-full mb-8 btn-interactive py-3 bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500/20 dark:hover:bg-cyan-500/30 dark:border dark:border-cyan-500/40 text-white dark:text-[#00c2ff] rounded-xl font-bold font-mono flex items-center justify-center gap-2 transition-all">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Run Comparison
        </button>

        <!-- Loading State -->
        <div id="compare-loading" class="hidden flex-col items-center justify-center py-8 space-y-3">
          <svg class="w-8 h-8 text-cyan-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span class="text-sm font-mono text-slate-500 dark:text-slate-400">Fetching room feeds...</span>
        </div>

        <!-- Results Grid -->
        <div id="compare-results" class="hidden">
          <div class="grid grid-cols-3 gap-0 bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            
            <!-- Headers -->
            <div class="p-4 border-b border-r border-slate-200 dark:border-slate-800 flex items-end">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Metric</span>
            </div>
            <div class="p-4 border-b border-r border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-900/60">
              <span id="compare-title-a" class="font-mono font-bold text-cyan-600 dark:text-[#00c2ff]">Room A</span>
            </div>
            <div class="p-4 border-b border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-900/60">
              <span id="compare-title-b" class="font-mono font-bold text-cyan-600 dark:text-[#00c2ff]">Room B</span>
            </div>

            <!-- Health Score -->
            <div class="p-4 border-b border-r border-slate-200 dark:border-slate-800 flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
              Overall Health
            </div>
            <div id="compare-health-a" class="p-4 border-b border-r border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-lg sm:text-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900/60"></div>
            <div id="compare-health-b" class="p-4 border-b border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-lg sm:text-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900/60"></div>

            <!-- Spam Share -->
            <div class="p-4 border-b border-r border-slate-200 dark:border-slate-800 flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
              Spam Share
            </div>
            <div id="compare-spam-a" class="p-4 border-b border-r border-slate-200 dark:border-slate-800 text-center font-mono text-sm flex items-center justify-center bg-slate-50 dark:bg-slate-900/60"></div>
            <div id="compare-spam-b" class="p-4 border-b border-slate-200 dark:border-slate-800 text-center font-mono text-sm flex items-center justify-center bg-slate-50 dark:bg-slate-900/60"></div>

            <!-- HHI -->
            <div class="p-4 border-b border-r border-slate-200 dark:border-slate-800 flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
              DID Concentration
            </div>
            <div id="compare-hhi-a" class="p-4 border-b border-r border-slate-200 dark:border-slate-800 text-center font-mono text-sm flex items-center justify-center bg-slate-50 dark:bg-slate-900/60"></div>
            <div id="compare-hhi-b" class="p-4 border-b border-slate-200 dark:border-slate-800 text-center font-mono text-sm flex items-center justify-center bg-slate-50 dark:bg-slate-900/60"></div>

            <!-- Sample Size -->
            <div class="p-4 border-r border-slate-200 dark:border-slate-800 flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
              Sample Size
            </div>
            <div id="compare-count-a" class="p-4 border-r border-slate-200 dark:border-slate-800 text-center font-mono text-sm text-slate-500 flex items-center justify-center bg-slate-50 dark:bg-slate-900/60"></div>
            <div id="compare-count-b" class="p-4 border-slate-200 dark:border-slate-800 text-center font-mono text-sm text-slate-500 flex items-center justify-center bg-slate-50 dark:bg-slate-900/60"></div>
          </div>
          
          <div class="mt-6 flex justify-center">
             <div id="compare-winner" class="px-5 py-2.5 rounded-full font-mono font-bold text-sm bg-cyan-100 dark:bg-cyan-900/30 border border-cyan-300 dark:border-cyan-700/50 text-cyan-800 dark:text-cyan-300 shadow-sm">
             </div>
          </div>
        </div>

      </div>
    </div>
  </div>`;

html = html.replace(oldModalRegex, newModalHtml);
fs.writeFileSync('public/index.html', html);
