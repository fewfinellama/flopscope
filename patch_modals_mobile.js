import fs from 'fs';
let html = fs.readFileSync('public/index.html', 'utf8');

// Fix Crypto Studio modal
html = html.replace(
  'id="crypto-studio-content" class="glass-panel modal-enter rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full sm:my-auto flex flex-col"',
  'id="crypto-studio-content" class="glass-panel modal-enter rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full sm:my-auto flex flex-col max-h-[85vh] sm:max-h-none overflow-y-auto"'
);

// Fix Generic Modal (Proof Inspector)
html = html.replace(
  'id="modal-container" class="glass-panel !bg-[var(--bg-app)] modal-enter rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full sm:my-auto flex flex-col"',
  'id="modal-container" class="glass-panel !bg-[var(--bg-app)] modal-enter rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full sm:my-auto flex flex-col max-h-[85vh] sm:max-h-none overflow-y-auto"'
);

// Fix Compare Modal width (wrap the grid in overflow-x-auto)
html = html.replace(
  '<div class="grid grid-cols-3 gap-0 bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">',
  '<div class="overflow-x-auto"><div class="grid grid-cols-3 gap-0 bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 min-w-[400px] overflow-hidden">'
);
html = html.replace(
  '<!-- Sample Size -->',
  '</div><!-- Sample Size -->'
);
// Wait, the grid contains all headers and metrics. I need to close the overflow wrapper after the grid.
// Better way: just add min-w-[500px] to the grid, and wrap the grid block.
