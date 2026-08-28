import fs from 'fs';

// 1. Update index.html
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace(
  '<button id="health-pill-trigger" class="hidden items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-semibold transition-opacity hover:opacity-80 border cursor-pointer">',
  '<div id="health-pill-trigger" class="hidden items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-semibold border">'
);
html = html.replace(
  '                <span id="health-pill-text">Calculating...</span>\n              </button>',
  `                <span id="health-pill-text">Calculating...</span>
              </div>
              <button id="health-modal-trigger" class="hidden items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono font-bold transition-opacity hover:opacity-80 border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 cursor-pointer shadow-sm">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <span>Diagnostic Report</span>
              </button>`
);
fs.writeFileSync('public/index.html', html);

// 2. Update app.js
let app = fs.readFileSync('public/js/app.js', 'utf8');
app = app.replace(
  'const healthBtn = document.getElementById("health-pill-trigger");',
  'const healthBtn = document.getElementById("health-modal-trigger");'
);
fs.writeFileSync('public/js/app.js', app);

// 3. Update api.js
let api = fs.readFileSync('public/js/api.js', 'utf8');
api = api.replace(
  /  if \(el.statHealth\) \{/,
  `  const healthModalTrigger = document.getElementById("health-modal-trigger");
  if (healthModalTrigger) {
    if (metrics.sampleSize >= 10) {
      healthModalTrigger.classList.remove('hidden');
      healthModalTrigger.classList.add('flex');
    } else {
      healthModalTrigger.classList.add('hidden');
      healthModalTrigger.classList.remove('flex');
    }
  }

  if (el.statHealth) {`
);
fs.writeFileSync('public/js/api.js', api);

