import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');

const oldBtnRegex = /<!-- Compare Rooms Button -->[\s\S]*?<\/button>/;
const newBtn = `<!-- Compare Rooms Button -->
      <button id="nav-compare-btn" class="btn-interactive px-3 py-2 bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-mono font-medium flex items-center gap-2 shadow-sm mr-2" title="Compare Rooms">
        <svg class="w-4 h-4 text-cyan-500 dark:text-[#00c2ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
        <span>Compare</span>
      </button>`;

html = html.replace(oldBtnRegex, newBtn);
fs.writeFileSync('public/index.html', html);
