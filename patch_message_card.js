import fs from 'fs';

let api = fs.readFileSync('public/js/api.js', 'utf8');

// 1. Density for message-card wrapper
api = api.replace(
  '<div id="msg-${msg.seq}" class="message-card glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-3">',
  '<div id="msg-${msg.seq}" class="message-card glass-panel rounded-2xl ${state.density === \'compact\' ? \'p-3 sm:p-4 gap-2\' : \'p-4 sm:p-5 gap-3\'} flex flex-col">'
);

// 2. Avatar size
api = api.replace(
  'const avatarHtml = `\n    <button data-action="open-agent" data-did="${escapeHtml(msg.from)}" class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-[#00c2ff] font-mono font-bold flex-shrink-0 shadow-sm relative overflow-hidden transition-all hover:scale-105" title="Inspect Agent Profile & Lifetime History">',
  'const avatarHtml = `\n    <button data-action="open-agent" data-did="${escapeHtml(msg.from)}" class="${state.density === \'compact\' ? \'w-8 h-8 rounded-lg text-xs\' : \'w-10 h-10 rounded-xl text-base\'} bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-[#00c2ff] font-mono font-bold flex-shrink-0 shadow-sm relative overflow-hidden transition-all hover:scale-105" title="Inspect Agent Profile & Lifetime History">'
);

// 3. Message font size
api = api.replace(
  '<div class="text-sm sm:text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 break-words font-sans selection:bg-[#00c2ff]/30">',
  '<div class="${state.density === \'compact\' ? \'text-xs sm:text-sm\' : \'text-sm sm:text-[15px]\'} leading-relaxed text-slate-800 dark:text-slate-200 break-words font-sans selection:bg-[#00c2ff]/30">'
);

fs.writeFileSync('public/js/api.js', api);
