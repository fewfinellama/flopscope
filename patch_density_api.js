import fs from 'fs';

let api = fs.readFileSync('public/js/api.js', 'utf8');

// 1. Update createRoomButtonHtml
const roomSearch = `        <div class="flex items-start justify-between gap-2 w-full">
          <div class="flex flex-col gap-1 min-w-0">
            <span class="font-mono text-sm tracking-tight truncate flex items-center gap-1.5">`;

const roomReplace = `        <div class="flex items-start justify-between gap-2 w-full">
          <div class="flex flex-col \${state.density === 'compact' ? 'gap-0.5' : 'gap-1'} min-w-0">
            <span class="font-mono \${state.density === 'compact' ? 'text-xs' : 'text-sm'} tracking-tight truncate flex items-center gap-1.5">`;

api = api.replace(roomSearch, roomReplace);
api = api.replace(
  'class="room-nav-btn w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 text-left transition-all duration-150 flex flex-col gap-1.5 ${activeClass}"',
  'class="room-nav-btn w-full ${state.density === \'compact\' ? \'p-2 gap-1\' : \'p-3 gap-1.5\'} rounded-xl border border-slate-200 dark:border-slate-700/80 text-left transition-all duration-150 flex flex-col ${activeClass}"'
);
api = api.replace(
  '          r.topic\n            ? `<p class="text-xs text-slate-500 dark:text-slate-400 truncate w-full mt-0.5">${escapeHtml(r.topic)}</p>`\n            : \'\'',
  '          r.topic && state.density !== \'compact\'\n            ? `<p class="text-xs text-slate-500 dark:text-slate-400 truncate w-full mt-0.5">${escapeHtml(r.topic)}</p>`\n            : \'\''
);

// 2. Update renderMessages (for message rows)
const msgSearch = `<div class="message-row group flex gap-3 sm:gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800/50">`;
const msgReplace = `<div class="message-row group flex \${state.density === 'compact' ? 'gap-2 sm:gap-3 p-2' : 'gap-3 sm:gap-4 p-4'} hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800/50">`;
api = api.replace(msgSearch, msgReplace);

api = api.replace(
  '<div class="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-mono font-bold flex-shrink-0 border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden relative cursor-pointer" onclick="window.openAgentDrawer(\'${escapeHtml(msg.did)}\')">',
  '<div class="${state.density === \'compact\' ? \'w-8 h-8 sm:w-9 sm:h-9\' : \'w-10 h-10 sm:w-11 sm:h-11\'} rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-mono font-bold flex-shrink-0 border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden relative cursor-pointer" onclick="window.openAgentDrawer(\'${escapeHtml(msg.did)}\')">'
);

api = api.replace(
  '<div class="flex-1 min-w-0 space-y-1 sm:space-y-1.5">',
  '<div class="flex-1 min-w-0 ${state.density === \'compact\' ? \'space-y-0.5\' : \'space-y-1 sm:space-y-1.5\'}">'
);

api = api.replace(
  '<div class="text-[15px] sm:text-base text-slate-800 dark:text-slate-200 font-sans leading-relaxed break-words">',
  '<div class="${state.density === \'compact\' ? \'text-[13px] sm:text-sm\' : \'text-[15px] sm:text-base\'} text-slate-800 dark:text-slate-200 font-sans leading-relaxed break-words">'
);

api = api.replace(
  '<span class="font-bold text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-[200px] hover:text-[#00c2ff] transition-colors cursor-pointer" onclick="window.openAgentDrawer(\'${escapeHtml(msg.did)}\')">',
  '<span class="${state.density === \'compact\' ? \'text-sm\' : \'\'} font-bold text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-[200px] hover:text-[#00c2ff] transition-colors cursor-pointer" onclick="window.openAgentDrawer(\'${escapeHtml(msg.did)}\')">'
);

// We need to re-render when density changes.
// Since we trigger 'density-changed' event in theme.js, let's catch it in app.js
fs.writeFileSync('public/js/api.js', api);
