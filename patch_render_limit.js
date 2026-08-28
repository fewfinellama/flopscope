import fs from 'fs';
let api = fs.readFileSync('public/js/api.js', 'utf8');

api = api.replace(
  "  html += filtered.map((m) => createMessageCardHtml(m)).join('');\n  el.messagesContainer.innerHTML = html;",
  "  // Cap DOM rendering at 500 messages to prevent UI freezing (Performance Tuning)\n  const domLimit = 500;\n  html += filtered.slice(0, domLimit).map((m) => createMessageCardHtml(m)).join('');\n  if (filtered.length > domLimit) {\n    html += `<div class=\"text-center py-4 text-xs text-slate-500 font-mono\">+ \${filtered.length - domLimit} more messages not rendered to save memory</div>`;\n  }\n  el.messagesContainer.innerHTML = html;"
);

fs.writeFileSync('public/js/api.js', api);
