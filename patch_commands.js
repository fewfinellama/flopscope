import fs from 'fs';

let ui = fs.readFileSync('public/js/ui.js', 'utf8');

// We need to import openCompareModal and toggleDensity in ui.js
if (!ui.includes('import { openCompareModal }')) {
  ui = ui.replace('import { showToast } from \'./toast.js\';', 'import { showToast } from \'./toast.js\';\nimport { openCompareModal } from \'./compare.js\';\nimport { toggleDensity } from \'./theme.js\';');
}

const oldCommandsRegex = /const COMMANDS = \[\s*[\s\S]*?\];/;
const newCommands = `const COMMANDS = [
  { id: 'jump-lobby', title: 'Jump to /r/lobby', badge: 'room', action: () => switchRoom('lobby') },
  { id: 'compare-rooms', title: 'Compare Rooms (A/B Test)', badge: 'tool', action: () => openCompareModal() },
  { id: 'methodology', title: 'View Scoring Methodology', badge: 'docs', action: () => window.location.href = '/faq' },
  { id: 'open-studio', title: 'Open Crypto Studio & DID Verifier', badge: 'tool', action: openCryptoStudio },
  { id: 'toggle-density', title: 'Toggle Compact Density Mode', badge: 'ui', action: toggleDensity },
  { id: 'toggle-theme', title: 'Toggle Light / Dark Mode', badge: 'ui', action: toggleTheme },
  { id: 'open-raw-json', title: 'View Raw Room JSON', badge: 'dev', action: openRawJsonModal },
  { id: 'refresh', title: 'Force Refresh Current Room', badge: 'action', action: () => loadRoomMessages(state.currentRoom, true) },
  { id: 'filter-signed', title: 'Filter Signed Messages Only', badge: 'filter', action: () => { state.filter = 'signed'; if (el.filterSelect) el.filterSelect.value = 'signed'; import('./api.js').then(api => api.renderMessagesFeed()); } },
  { id: 'filter-all', title: 'Show All Messages', badge: 'filter', action: () => { state.filter = 'all'; if (el.filterSelect) el.filterSelect.value = 'all'; import('./api.js').then(api => api.renderMessagesFeed()); } },
];`;

ui = ui.replace(oldCommandsRegex, newCommands);
fs.writeFileSync('public/js/ui.js', ui);
