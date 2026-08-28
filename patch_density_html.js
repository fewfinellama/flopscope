import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');

const desktopDensityBtn = `
      <!-- Density Toggle Button -->
      <button id="density-toggle-btn" class="btn-interactive p-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-colors shadow-sm" title="Toggle Compact Mode">
        <svg id="density-comfortable-icon" class="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg id="density-compact-icon" class="w-4 h-4 text-cyan-600 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
        </svg>
      </button>`;

html = html.replace('      </button>\n\n    </div>', '      </button>' + desktopDensityBtn + '\n\n    </div>');

const mobileDensityBtn = `
      <!-- Mobile Density Toggle -->
      <button id="mobile-density-toggle-btn" class="btn-interactive p-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 touch-target flex items-center justify-center">
        <svg id="mobile-density-comfortable-icon" class="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg id="mobile-density-compact-icon" class="w-4 h-4 text-cyan-600 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
        </svg>
      </button>`;

html = html.replace('      </button>\n\n      <!-- Mobile Quick Menu Trigger -->', '      </button>\n' + mobileDensityBtn + '\n      <!-- Mobile Quick Menu Trigger -->');

fs.writeFileSync('public/index.html', html);
