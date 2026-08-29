import fs from 'fs';
let html = fs.readFileSync('public/faq.html', 'utf8');

// Remove the outer glass-panel
html = html.replace(
  '<div class="glass-panel rounded-2xl p-6 sm:p-8 space-y-8 animate-fadeIn border border-slate-200 dark:border-slate-800">',
  '<div class="space-y-8 animate-fadeIn">'
);

fs.writeFileSync('public/faq.html', html);
