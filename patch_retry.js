const fs = require('fs');
let api = fs.readFileSync('public/js/api.js', 'utf8');

api = api.replace(
  /<button onclick="this\.innerHTML=.*? class="mt-4 px-5 py-2\.5 bg-slate-900/g,
  '<button onclick="window.flopscope.loadRoomMessages(\\'${escapeHtml(roomName)}\\', true, true)" class="mt-4 px-5 py-2.5 bg-slate-900'
);

api = api.replace(
  'rounded-3xl glass-panel border border-rose-500/20',
  'rounded-2xl glass-panel border border-rose-500/20 overflow-hidden'
);

fs.writeFileSync('public/js/api.js', api);
