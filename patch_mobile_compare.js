import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');

const compareBtn = `
        <!-- Compare Rooms button -->
        <button id="mobile-compare-btn" class="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left flex items-center justify-between text-slate-700 dark:text-slate-300">
          <span>Compare Rooms (A/B Test)</span>
          <span class="text-cyan-700 dark:text-[#00c2ff] font-bold">→</span>
        </button>

        <!-- Raw JSON button -->`;

html = html.replace('        <!-- Raw JSON button -->', compareBtn);

fs.writeFileSync('public/index.html', html);
