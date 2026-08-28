import fs from 'fs';

let api = fs.readFileSync('public/js/api.js', 'utf8');

api = api.replace(
  '  const avatarHtml = isSigned\n    ? generateIdenticonSvg(msg.from, 36)\n    : `\n      <div class="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-slate-600 dark:text-slate-300 text-xs shadow-sm flex-shrink-0">\n        ${escapeHtml((msg.from || \'U\').charAt(0).toUpperCase())}\n      </div>\n    `;',
  '  const avatarHtml = isSigned\n    ? generateIdenticonSvg(msg.from, state.density === \'compact\' ? 28 : 36)\n    : `\n      <div class="${state.density === \'compact\' ? \'w-7 h-7 text-[10px]\' : \'w-9 h-9 text-xs\'} rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-slate-600 dark:text-slate-300 shadow-sm flex-shrink-0">\n        ${escapeHtml((msg.from || \'U\').charAt(0).toUpperCase())}\n      </div>\n    `;'
);

fs.writeFileSync('public/js/api.js', api);
