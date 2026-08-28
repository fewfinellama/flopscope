import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');

const compareModal = `
  <!-- COMPARE ROOMS MODAL -->
  <div id="compare-modal-overlay" class="overlay-enter fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-md hidden items-start justify-center pt-10 sm:pt-16 p-3 sm:p-4">
    <div class="glass-panel modal-enter rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full flex flex-col max-h-[85vh]">
      <!-- Header -->
      <div class="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">Compare Rooms</h2>
            <p class="text-xs text-slate-500 font-sans">Side-by-side health analysis</p>
          </div>
        </div>
        <button id="close-compare-btn" class="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 touch-target">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Content Area -->
      <div class="p-4 sm:p-5 overflow-y-auto">
        
        <!-- Room Selectors -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="flex items-center gap-2">
            <span class="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 w-16">Room A:</span>
            <input type="text" id="compare-room-a" class="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none" placeholder="e.g. lobby" />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 w-16">Room B:</span>
            <input type="text" id="compare-room-b" class="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none" placeholder="e.g. alerts" />
          </div>
        </div>

        <button id="run-compare-btn" class="w-full mb-6 btn-interactive py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold font-mono flex items-center justify-center gap-2 shadow-sm transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Run Comparison
        </button>

        <!-- Results Grid -->
        <div id="compare-results" class="hidden">
          <div class="grid grid-cols-3 gap-4 text-sm font-mono">
            <!-- Headers -->
            <div class="font-bold text-slate-500 pb-2 border-b border-slate-200 dark:border-slate-800">Metric</div>
            <div id="compare-title-a" class="font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800 truncate">Room A</div>
            <div id="compare-title-b" class="font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800 truncate">Room B</div>

            <!-- Health Score -->
            <div class="text-slate-600 dark:text-slate-400 py-2 border-b border-slate-100 dark:border-slate-800/50">Overall Health</div>
            <div id="compare-health-a" class="py-2 border-b border-slate-100 dark:border-slate-800/50 font-bold text-2xl"></div>
            <div id="compare-health-b" class="py-2 border-b border-slate-100 dark:border-slate-800/50 font-bold text-2xl"></div>

            <!-- Spam Share -->
            <div class="text-slate-600 dark:text-slate-400 py-2 border-b border-slate-100 dark:border-slate-800/50">Spam / Boilerplate</div>
            <div id="compare-spam-a" class="py-2 border-b border-slate-100 dark:border-slate-800/50 font-semibold"></div>
            <div id="compare-spam-b" class="py-2 border-b border-slate-100 dark:border-slate-800/50 font-semibold"></div>

            <!-- HHI -->
            <div class="text-slate-600 dark:text-slate-400 py-2 border-b border-slate-100 dark:border-slate-800/50">DID Concentration</div>
            <div id="compare-hhi-a" class="py-2 border-b border-slate-100 dark:border-slate-800/50 font-semibold"></div>
            <div id="compare-hhi-b" class="py-2 border-b border-slate-100 dark:border-slate-800/50 font-semibold"></div>

            <!-- Messages -->
            <div class="text-slate-600 dark:text-slate-400 py-2 border-b border-slate-100 dark:border-slate-800/50">Sample Size</div>
            <div id="compare-count-a" class="py-2 border-b border-slate-100 dark:border-slate-800/50 text-slate-500"></div>
            <div id="compare-count-b" class="py-2 border-b border-slate-100 dark:border-slate-800/50 text-slate-500"></div>
          </div>
          
          <div class="mt-6 flex justify-center">
             <div id="compare-winner" class="px-6 py-3 rounded-xl font-mono font-bold text-sm bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300">
             </div>
          </div>
        </div>

        <div id="compare-loading" class="hidden flex-col items-center justify-center py-12 space-y-4">
          <svg class="w-8 h-8 text-indigo-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span class="text-sm font-mono text-slate-500">Fetching room feeds...</span>
        </div>
      </div>
    </div>
  </div>
`;

html = html.replace('  <!-- COMMAND PALETTE MODAL', compareModal + '\n  <!-- COMMAND PALETTE MODAL');
fs.writeFileSync('public/index.html', html);
