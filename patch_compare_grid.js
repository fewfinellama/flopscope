import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');

const regex = /<div id="compare-results" class="hidden">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;

const replacement = `<div id="compare-results" class="hidden">
          <div class="overflow-x-auto w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div class="grid grid-cols-3 gap-0 min-w-[500px] bg-slate-100/50 dark:bg-slate-900/30 overflow-hidden">
              
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
                Concentration
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
          </div>
          
          <div class="mt-6 flex justify-center">
             <div id="compare-winner" class="px-5 py-2.5 rounded-full font-mono font-bold text-sm bg-cyan-100 dark:bg-cyan-900/30 border border-cyan-300 dark:border-cyan-700/50 text-cyan-800 dark:text-cyan-300 shadow-sm">
             </div>
          </div>
        </div>

      </div>
    </div>
  </div>`;

html = html.replace(regex, replacement);
fs.writeFileSync('public/index.html', html);
