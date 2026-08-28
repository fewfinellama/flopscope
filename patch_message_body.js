import fs from 'fs';

let api = fs.readFileSync('public/js/api.js', 'utf8');

api = api.replace(
  '<div id="msg-body-${msg.seq}" class="text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed break-words font-sans selection:bg-cyan-500/30 line-clamp-3 transition-all duration-300">',
  '<div id="msg-body-${msg.seq}" class="text-slate-800 dark:text-slate-200 ${state.density === \'compact\' ? \'text-xs sm:text-sm\' : \'text-sm sm:text-base\'} leading-relaxed break-words font-sans selection:bg-cyan-500/30 line-clamp-3 transition-all duration-300">'
);

fs.writeFileSync('public/js/api.js', api);
