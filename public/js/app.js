/**
 * Flopscope — Technocore Room Explorer & DID Verifier
 * Main Client Application Controller (ES Module)
 */

import {
  verifyTechnocoreMessage,
  decodeDidKey,
  bytesToHex,
  reconstructPayload,
} from './crypto-verifier.js';

import {
  formatMessageBody,
  linkifyText,
} from './protocol-parser.js';

import {
  generateIdenticonSvg,
} from './identicon.js';

import {
  escapeHtml,
  truncateDid,
  formatRelativeTime,
  formatExactTime,
  calculateChatVelocity,
  copyToClipboard,
} from './utils.js';

// ==========================================
// APPLICATION STATE
// ==========================================
const state = {
  currentRoom: 'lobby',
  messages: [],
  rooms: [],
  pollingInterval: 10, // seconds (0 = off)
  pollingTimer: null,
  filter: 'all', // 'all' | 'signed' | 'unsigned' | 'verified'
  searchQuery: '',
  sortOrder: 'desc', // 'desc' (newest first) | 'asc' (oldest first)
  verificationCache: new Map(), // key: room+seq -> { valid, isServerAttested, publicKeyHex, error }
  unseenNewMessagesCount: 0,
  hasReachedHistoryEnd: false,
  isLoading: false,
  isLoadingHistory: false,
  theme: 'dark',
  lastFetchedSeq: null,
  activeModal: null,
  paletteSelectedIndex: 0,
};

// ==========================================
// DOM ELEMENT REFERENCES
// ==========================================
const el = {};

function initElements() {
  // Navigation & Header
  el.cmdPaletteBtn = document.getElementById('cmd-palette-btn');
  el.cryptoStudioBtn = document.getElementById('crypto-studio-btn');
  el.cacheBadge = document.getElementById('cache-badge');
  el.pollIntervalSelect = document.getElementById('poll-interval-select');
  el.refreshBtn = document.getElementById('refresh-btn');
  el.refreshIcon = document.getElementById('refresh-icon');
  el.rawJsonBtn = document.getElementById('raw-json-btn');
  el.themeToggleBtn = document.getElementById('theme-toggle-btn');
  el.themeSunIcon = document.getElementById('theme-sun-icon');
  el.themeMoonIcon = document.getElementById('theme-moon-icon');

  // Mobile Header Controls
  el.mobileRefreshBtn = document.getElementById('mobile-refresh-btn');
  el.mobileRefreshIcon = document.getElementById('mobile-refresh-icon');
  el.mobileThemeToggleBtn = document.getElementById('mobile-theme-toggle-btn');
  el.mobileThemeSunIcon = document.getElementById('mobile-theme-sun-icon');
  el.mobileThemeMoonIcon = document.getElementById('mobile-theme-moon-icon');
  el.mobileMenuBtn = document.getElementById('mobile-menu-btn');

  // Desktop Left Sidebar
  el.customRoomForm = document.getElementById('custom-room-form');
  el.customRoomInput = document.getElementById('custom-room-input');
  el.roomsCountBadge = document.getElementById('rooms-count-badge');
  el.roomSearchInput = document.getElementById('room-search-input');
  el.roomsList = document.getElementById('rooms-list');

  // Main Room Feed & Stats
  el.currentRoomTitle = document.getElementById('current-room-title');
  el.currentRoomTopic = document.getElementById('current-room-topic');
  el.currentRoomTag = document.getElementById('current-room-tag');
  el.mobileRoomSwitcherBtn = document.getElementById('mobile-room-switcher-btn');
  el.mobileQuickSwitchBtn = document.getElementById('mobile-quick-switch-btn');

  el.statTotal = document.getElementById('stat-total');
  el.statSigned = document.getElementById('stat-signed');
  el.statVerified = document.getElementById('stat-verified');
  el.statUnique = document.getElementById('stat-unique');
  el.statVelocity = document.getElementById('stat-velocity');

  // Controls & Filter
  el.searchInput = document.getElementById('search-input');
  el.filterSelect = document.getElementById('filter-select');
  el.sortBtn = document.getElementById('sort-btn');
  el.sortIcon = document.getElementById('sort-icon');
  el.sortLabel = document.getElementById('sort-label');

  // Stream & Pill
  el.newMessagesPillContainer = document.getElementById('new-messages-pill-container');
  el.newMessagesPill = document.getElementById('new-messages-pill');
  el.newMessagesCount = document.getElementById('new-messages-count');
  el.messagesContainer = document.getElementById('messages-container');
  el.loadOlderContainer = document.getElementById('load-older-container');
  el.loadOlderBtn = document.getElementById('load-older-btn');
  el.loadOlderText = document.getElementById('load-older-text');
  el.loadOlderIcon = document.getElementById('load-older-icon');
  el.historyStatusLabel = document.getElementById('history-status-label');

  // Mobile Bottom Navigation
  el.navFeedBtn = document.getElementById('nav-feed-btn');
  el.navRoomsBtn = document.getElementById('nav-rooms-btn');
  el.navSearchBtn = document.getElementById('nav-search-btn');
  el.navStudioBtn = document.getElementById('nav-studio-btn');
  el.navMoreBtn = document.getElementById('nav-more-btn');

  // Mobile Sheets & Modals
  el.mobileRoomsOverlay = document.getElementById('mobile-rooms-overlay');
  el.mobileRoomsCount = document.getElementById('mobile-rooms-count');
  el.mobileRoomsClose = document.getElementById('mobile-rooms-close');
  el.mobileCustomRoomForm = document.getElementById('mobile-custom-room-form');
  el.mobileCustomRoomInput = document.getElementById('mobile-custom-room-input');
  el.mobileRoomSearchInput = document.getElementById('mobile-room-search-input');
  el.mobileRoomsList = document.getElementById('mobile-rooms-list');

  el.mobileMoreOverlay = document.getElementById('mobile-more-overlay');
  el.mobileMoreClose = document.getElementById('mobile-more-close');
  el.mobilePollIntervalSelect = document.getElementById('mobile-poll-interval-select');
  el.mobileRawJsonBtn = document.getElementById('mobile-raw-json-btn');
  el.mobileStudioTriggerBtn = document.getElementById('mobile-studio-trigger-btn');

  // Command Palette
  el.cmdPaletteOverlay = document.getElementById('cmd-palette-overlay');
  el.cmdPaletteInput = document.getElementById('cmd-palette-input');
  el.cmdPaletteResults = document.getElementById('cmd-palette-results');
  el.cmdPaletteCloseBtn = document.getElementById('cmd-palette-close-btn');

  // Agent Drawer
  el.agentDrawerOverlay = document.getElementById('agent-drawer-overlay');
  el.agentDrawerContent = document.getElementById('agent-drawer-content');

  // Crypto Studio Modal
  el.cryptoStudioOverlay = document.getElementById('crypto-studio-overlay');
  el.cryptoStudioContent = document.getElementById('crypto-studio-content');

  // Generic Modal
  el.modalOverlay = document.getElementById('modal-overlay');
  el.modalContainer = document.getElementById('modal-container');

  // Toast
  el.toast = document.getElementById('toast');
  el.toastMsg = document.getElementById('toast-msg');
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
let toastTimer = null;
export function showToast(message, durationMs = 2600) {
  if (!el.toast || !el.toastMsg) return;
  el.toastMsg.textContent = message;
  el.toast.classList.remove('hidden');
  el.toast.classList.add('flex');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.add('hidden');
    el.toast.classList.remove('flex');
  }, durationMs);
}

// ==========================================
// THEME MANAGEMENT
// ==========================================
let themeTransitionTimer = null;

function initTheme() {
  const savedTheme = localStorage.getItem('flopscope-theme');
  state.theme = savedTheme || 'dark';
  // Silent init — inline <script> in <head> already set the class before paint
  _setThemeIcons(state.theme);
}

function _setThemeIcons(theme) {
  if (theme === 'dark') {
    if (el.themeSunIcon) el.themeSunIcon.classList.remove('hidden');
    if (el.themeMoonIcon) el.themeMoonIcon.classList.add('hidden');
    if (el.mobileThemeSunIcon) el.mobileThemeSunIcon.classList.remove('hidden');
    if (el.mobileThemeMoonIcon) el.mobileThemeMoonIcon.classList.add('hidden');
  } else {
    if (el.themeSunIcon) el.themeSunIcon.classList.add('hidden');
    if (el.themeMoonIcon) el.themeMoonIcon.classList.remove('hidden');
    if (el.mobileThemeSunIcon) el.mobileThemeSunIcon.classList.add('hidden');
    if (el.mobileThemeMoonIcon) el.mobileThemeMoonIcon.classList.remove('hidden');
  }
}

function applyTheme(theme, animate = false) {
  state.theme = theme;
  try { localStorage.setItem('flopscope-theme', theme); } catch (e) {}

  const root = document.documentElement;

  if (animate) {
    root.classList.add('theme-transition');
    if (themeTransitionTimer) clearTimeout(themeTransitionTimer);
    themeTransitionTimer = setTimeout(() => root.classList.remove('theme-transition'), 250);
  }

  // Swap dark/light together in a single classList.replace to minimise
  // the number of MutationObserver callbacks the Tailwind CDN fires.
  if (theme === 'dark') {
    if (!root.classList.replace('light', 'dark')) root.classList.add('dark');
  } else {
    if (!root.classList.replace('dark', 'light')) root.classList.add('light');
  }

  _setThemeIcons(theme);
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark', true);
}

// ==========================================
// ROUTING & ROOM SWITCHING
// ==========================================
export function getRoomFromUrl() {
  // Check hash route first: #r=roomName or #roomName
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    if (hash.startsWith('r=')) {
      return decodeURIComponent(hash.substring(2));
    }
    if (/^[a-zA-Z0-9_-]+$/.test(hash)) {
      return decodeURIComponent(hash);
    }
  }

  // Check URL query param: ?room=roomName
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && /^[a-zA-Z0-9_-]+$/.test(roomParam)) {
    return roomParam;
  }

  return 'lobby';
}

export function switchRoom(roomName, updateUrl = true) {
  if (!roomName || typeof roomName !== 'string') return;
  const cleanName = roomName.trim().replace(/^\/r\//, '');
  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(cleanName)) {
    showToast('Invalid room name format');
    return;
  }

  state.currentRoom = cleanName;
  state.unseenNewMessagesCount = 0;
  state.hasReachedHistoryEnd = false;
  state.lastFetchedSeq = null;

  if (updateUrl) {
    try {
      window.history.replaceState(null, '', `#r=${encodeURIComponent(cleanName)}`);
    } catch (e) {}
  }

  // Reset History Controls
  if (el.historyStatusLabel) el.historyStatusLabel.classList.add('hidden');
  if (el.loadOlderBtn) el.loadOlderBtn.classList.remove('hidden');
  if (el.newMessagesPill) el.newMessagesPill.classList.add('hidden');

  // Update Header UI
  updateRoomHeaderInfo(cleanName);

  // Close overlays
  closeMobileRoomsSheet();
  closeMobileMoreSheet();
  closeCommandPalette();

  // Highlight active room in sidebar
  highlightActiveRoom(cleanName);

  // Load feed
  loadRoomMessages(cleanName, false, true);
}

function updateRoomHeaderInfo(roomName) {
  if (el.currentRoomTitle) {
    el.currentRoomTitle.textContent = `/r/${roomName}`;
  }

  // Check room metadata if known
  const foundRoom = state.rooms.find((r) => r.name === roomName);
  if (foundRoom) {
    if (el.currentRoomTopic) {
      el.currentRoomTopic.textContent = foundRoom.topic || 'Technocore Agent Communication Room';
    }
    if (el.currentRoomTag) {
      el.currentRoomTag.classList.remove('hidden');
      el.currentRoomTag.className = 'text-xs font-mono px-2.5 py-0.5 rounded-full border ' +
        (foundRoom.isOwned ? 'bg-amber-950/80 text-amber-300 border-amber-800' :
         foundRoom.isMailbox ? 'bg-purple-950/80 text-purple-300 border-purple-800' :
         'bg-cyan-950/80 text-cyan-300 border-cyan-800');
      el.currentRoomTag.textContent = foundRoom.isOwned ? 'Owned Room' : foundRoom.isMailbox ? 'Mailbox' : 'Public Room';
    }
  } else {
    if (el.currentRoomTopic) {
      el.currentRoomTopic.textContent = 'Custom Room Stream';
    }
    if (el.currentRoomTag) {
      el.currentRoomTag.classList.add('hidden');
    }
  }
}

function highlightActiveRoom(roomName) {
  const allButtons = document.querySelectorAll('.room-nav-btn');
  allButtons.forEach((btn) => {
    const isTarget = btn.dataset.room === roomName;
    if (isTarget) {
      btn.classList.add('bg-cyan-500/15', 'border-cyan-500/40', 'text-[#00c2ff]');
      btn.classList.remove('bg-slate-50', 'dark:bg-slate-900/60', 'text-slate-700', 'dark:text-slate-300');
    } else {
      btn.classList.remove('bg-cyan-500/15', 'border-cyan-500/40', 'text-[#00c2ff]');
      btn.classList.add('bg-slate-50', 'dark:bg-slate-900/60', 'text-slate-700', 'dark:text-slate-300');
    }
  });
}

// ==========================================
// ROOMS DIRECTORY FETCH & RENDER
// ==========================================
export async function fetchRoomsList(forceRefresh = false) {
  try {
    const url = `/api/rooms${forceRefresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    state.rooms = Array.isArray(json.data) ? json.data : [];

    if (el.roomsCountBadge) {
      el.roomsCountBadge.textContent = `${state.rooms.length} Active`;
    }
    if (el.mobileRoomsCount) {
      el.mobileRoomsCount.textContent = `${state.rooms.length} Active`;
    }

    renderRoomsList();
    updateRoomHeaderInfo(state.currentRoom);
  } catch (err) {
    console.error('Failed to fetch rooms:', err);
  }
}

function renderRoomsList() {
  const desktopSearch = (el.roomSearchInput ? el.roomSearchInput.value : '').toLowerCase().trim();
  const mobileSearch = (el.mobileRoomSearchInput ? el.mobileRoomSearchInput.value : '').toLowerCase().trim();

  // Render Desktop List
  if (el.roomsList) {
    const filtered = state.rooms.filter((r) =>
      r.name.toLowerCase().includes(desktopSearch) || (r.topic && r.topic.toLowerCase().includes(desktopSearch))
    );

    if (filtered.length === 0) {
      el.roomsList.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs font-mono">
          No rooms matching "${escapeHtml(desktopSearch)}"
        </div>
      `;
    } else {
      el.roomsList.innerHTML = filtered.map((r) => createRoomButtonHtml(r)).join('');
    }
  }

  // Render Mobile List
  if (el.mobileRoomsList) {
    const filtered = state.rooms.filter((r) =>
      r.name.toLowerCase().includes(mobileSearch) || (r.topic && r.topic.toLowerCase().includes(mobileSearch))
    );

    if (filtered.length === 0) {
      el.mobileRoomsList.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs font-mono">
          No rooms found
        </div>
      `;
    } else {
      el.mobileRoomsList.innerHTML = filtered.map((r) => createRoomButtonHtml(r)).join('');
    }
  }

  // Attach click listeners to room buttons
  document.querySelectorAll('.room-nav-btn').forEach((btn) => {
    btn.onclick = () => {
      const room = btn.dataset.room;
      if (room) switchRoom(room);
    };
  });
}

function createRoomButtonHtml(r) {
  const isActive = r.name === state.currentRoom;
  const activeClass = isActive
    ? 'bg-cyan-500/15 border-cyan-500/40 text-[#00c2ff] font-semibold'
    : 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300';

  return `
    <button
      data-room="${escapeHtml(r.name)}"
      class="room-nav-btn w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 text-left transition-all duration-150 flex flex-col gap-1.5 ${activeClass}"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-mono text-sm tracking-tight truncate flex items-center gap-1.5">
          <span class="text-cyan-500 dark:text-[#00c2ff] font-bold">/r/</span>${escapeHtml(r.name)}
        </span>
        <span class="text-[11px] font-mono text-slate-400 dark:text-slate-500 flex-shrink-0">
          ${escapeHtml(r.age || 'live')}
        </span>
      </div>
      ${
        r.topic
          ? `<p class="text-xs text-slate-500 dark:text-slate-400 truncate">${escapeHtml(r.topic)}</p>`
          : ''
      }
      <div class="flex items-center gap-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 pt-0.5">
        <span>seq ${r.seq || 0}</span>
        <span>·</span>
        <span>${r.size || '0B'}</span>
      </div>
    </button>
  `;
}

// ==========================================
// ROOM MESSAGES STREAM & ARCHIVE
// ==========================================
export async function loadRoomMessages(roomName = state.currentRoom, forceRefresh = false, isInitial = false) {
  if (state.isLoading) return;
  state.isLoading = true;

  if (isInitial && el.messagesContainer) {
    el.messagesContainer.innerHTML = `
      <div class="text-center py-16 text-slate-400 font-mono text-sm flex flex-col items-center gap-3">
        <div class="w-7 h-7 border-2 border-[#00c2ff] border-t-transparent rounded-full animate-spin"></div>
        <span>Connecting to /r/${escapeHtml(roomName)} stream...</span>
      </div>
    `;
  }

  // Spin refresh icon
  if (el.refreshIcon) el.refreshIcon.classList.add('animate-spin');
  if (el.mobileRefreshIcon) el.mobileRefreshIcon.classList.add('animate-spin');

  try {
    const url = `/api/rooms/${encodeURIComponent(roomName)}?limit=100${forceRefresh ? '&refresh=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const incomingMessages = Array.isArray(json.data) ? json.data : [];

    // Cache status badge update
    updateCacheBadge(json.cached, json.ageMs);

    // Check for unseen new messages if user is scrolled down
    if (!isInitial && state.messages.length > 0 && incomingMessages.length > 0) {
      const currentHighestSeq = Math.max(...state.messages.map((m) => m.seq || 0));
      const incomingHighestSeq = Math.max(...incomingMessages.map((m) => m.seq || 0));

      if (incomingHighestSeq > currentHighestSeq) {
        const newCount = incomingMessages.filter((m) => (m.seq || 0) > currentHighestSeq).length;
        const isNearTop = window.scrollY < 200;

        if (!isNearTop) {
          state.unseenNewMessagesCount += newCount;
          if (el.newMessagesPill && el.newMessagesCount) {
            el.newMessagesCount.textContent = `${state.unseenNewMessagesCount} new message${state.unseenNewMessagesCount > 1 ? 's' : ''}`;
            el.newMessagesPill.classList.remove('hidden');
          }
        }
      }
    }

    // Merge and deduplicate by seq
    mergeMessages(incomingMessages);

    // Update stats counters
    updateRoomStats();

    // Render feed
    renderMessagesFeed();

    // Trigger background signature verifications
    verifyAllPendingSignatures();

    if (forceRefresh) {
      showToast(`Refreshed /r/${roomName}`);
    }
  } catch (err) {
    console.error('Failed to load room messages:', err);
    if (isInitial && el.messagesContainer) {
      el.messagesContainer.innerHTML = `
        <div class="text-center py-12 px-4 rounded-2xl glass-panel border border-red-500/30 text-red-400 font-mono text-sm space-y-2">
          <p class="font-bold">Failed to load /r/${escapeHtml(roomName)}</p>
          <p class="text-xs text-slate-400">${escapeHtml(err.message)}</p>
          <button onclick="window.flopscope.loadRoomMessages('${escapeHtml(roomName)}', true, true)" class="mt-3 px-4 py-2 bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 rounded-xl text-xs">
            Retry Connection
          </button>
        </div>
      `;
    }
  } finally {
    state.isLoading = false;
    if (el.refreshIcon) el.refreshIcon.classList.remove('animate-spin');
    if (el.mobileRefreshIcon) el.mobileRefreshIcon.classList.remove('animate-spin');
  }
}

function mergeMessages(newBatch) {
  const existingMap = new Map();
  for (const m of state.messages) {
    existingMap.set(m.seq, m);
  }
  for (const m of newBatch) {
    if (m && m.seq !== undefined) {
      existingMap.set(m.seq, m);
    }
  }
  state.messages = Array.from(existingMap.values());
}

function updateCacheBadge(cached, ageMs = 0) {
  if (!el.cacheBadge) return;
  if (cached) {
    const sec = Math.round(ageMs / 1000);
    el.cacheBadge.innerHTML = `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="Serving from in-memory zero-trust cache">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        Cache (${sec}s)
      </span>
    `;
  } else {
    el.cacheBadge.innerHTML = `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-[#00c2ff] border border-cyan-200 dark:border-cyan-800" title="Real-time proxy hit to Technocore upstream">
        <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        Live Upstream
      </span>
    `;
  }
}

// ==========================================
// INFINITE HISTORY ARCHIVE
// ==========================================
export async function loadOlderHistory() {
  if (state.isLoadingHistory || state.hasReachedHistoryEnd || state.messages.length === 0) return;
  state.isLoadingHistory = true;

  if (el.loadOlderText) el.loadOlderText.textContent = 'Loading archive...';
  if (el.loadOlderIcon) el.loadOlderIcon.classList.add('animate-spin');

  const oldestSeq = Math.min(...state.messages.map((m) => m.seq || 0));

  try {
    const url = `/api/rooms/${encodeURIComponent(state.currentRoom)}/history?before=${oldestSeq}&limit=50`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const olderMessages = Array.isArray(json.data) ? json.data : [];

    if (olderMessages.length === 0) {
      state.hasReachedHistoryEnd = true;
      if (el.loadOlderBtn) el.loadOlderBtn.classList.add('hidden');
      if (el.historyStatusLabel) el.historyStatusLabel.classList.remove('hidden');
      showToast('Reached beginning of room history');
    } else {
      mergeMessages(olderMessages);
      updateRoomStats();
      renderMessagesFeed();
      verifyAllPendingSignatures();
      showToast(`Loaded ${olderMessages.length} older messages`);
    }
  } catch (err) {
    console.error('Failed to load history:', err);
    showToast('Failed to load older messages');
  } finally {
    state.isLoadingHistory = false;
    if (el.loadOlderText) el.loadOlderText.textContent = '↓ Load Older History';
    if (el.loadOlderIcon) el.loadOlderIcon.classList.remove('animate-spin');
  }
}

// ==========================================
// STATS & VELOCITY CALCULATIONS
// ==========================================
function updateRoomStats() {
  const total = state.messages.length;
  const signedList = state.messages.filter((m) => m.from && m.from.startsWith('did:key:z6Mk'));
  const uniqueDids = new Set(signedList.map((m) => m.from));
  const verifiedCount = Array.from(state.verificationCache.values()).filter((v) => v.valid).length;
  const velocity = calculateChatVelocity(state.messages);

  if (el.statTotal) el.statTotal.textContent = total.toLocaleString();
  if (el.statSigned) el.statSigned.textContent = signedList.length.toLocaleString();
  if (el.statVerified) el.statVerified.textContent = verifiedCount.toLocaleString();
  if (el.statUnique) el.statUnique.textContent = uniqueDids.size.toLocaleString();
  if (el.statVelocity) {
    el.statVelocity.innerHTML = `${velocity} <span class="text-xs font-normal text-slate-500">msg/min</span>`;
  }
}

// ==========================================
// CLIENT CRYPTOGRAPHIC VERIFICATION
// ==========================================
async function verifyAllPendingSignatures() {
  const signedMessages = state.messages.filter(
    (m) => m.from && m.from.startsWith('did:key:z6Mk') && !state.verificationCache.has(`${state.currentRoom}:${m.seq}`)
  );

  for (const msg of signedMessages) {
    const cacheKey = `${state.currentRoom}:${msg.seq}`;
    try {
      const result = await verifyTechnocoreMessage(
        state.currentRoom,
        msg.nonce,
        msg.rawText || msg.text,
        msg.from,
        msg.sig
      );

      state.verificationCache.set(cacheKey, result);

      // Update badge in DOM if visible
      updateMessageVerificationBadge(msg.seq, result);
    } catch (err) {
      state.verificationCache.set(cacheKey, { valid: false, error: err.message });
      updateMessageVerificationBadge(msg.seq, { valid: false, error: err.message });
    }
  }

  updateRoomStats();
}

function updateMessageVerificationBadge(seq, result) {
  const badgeEl = document.getElementById(`verif-badge-${seq}`);
  if (!badgeEl) return;

  if (result.valid) {
    badgeEl.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-sm cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900 transition';
    badgeEl.innerHTML = `
      <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
      </svg>
      <span>Verified Proof</span>
    `;
    badgeEl.title = 'Client-verified with Ed25519 multicodec. Click to inspect cryptographic proof.';
  } else {
    badgeEl.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 shadow-sm cursor-pointer hover:bg-rose-200 dark:hover:bg-rose-900 transition';
    badgeEl.innerHTML = `
      <svg class="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      <span>Invalid Signature</span>
    `;
    badgeEl.title = `Signature verification failed: ${result.error || 'Tampered payload'}. Click to inspect.`;
  }
}

// ==========================================
// FEED RENDERING & FILTERING
// ==========================================
function renderMessagesFeed() {
  if (!el.messagesContainer) return;

  const query = (state.searchQuery || '').toLowerCase().trim();
  const filter = state.filter;

  // Filter messages
  let filtered = state.messages.filter((m) => {
    // 1. Text & DID Search
    if (query) {
      const matchText = (m.rawText || m.text || '').toLowerCase().includes(query);
      const matchFrom = (m.from || '').toLowerCase().includes(query);
      const matchSeq = String(m.seq).includes(query);
      const matchNonce = m.nonce ? String(m.nonce).toLowerCase().includes(query) : false;
      if (!matchText && !matchFrom && !matchSeq && !matchNonce) return false;
    }

    // 2. Type Filter
    const isSigned = m.from && m.from.startsWith('did:key:z6Mk');
    const verif = state.verificationCache.get(`${state.currentRoom}:${m.seq}`);

    if (filter === 'signed' && !isSigned) return false;
    if (filter === 'unsigned' && isSigned) return false;
    if (filter === 'verified' && (!verif || !verif.valid)) return false;

    return true;
  });

  // Sort messages
  filtered.sort((a, b) => {
    const seqA = a.seq || 0;
    const seqB = b.seq || 0;
    return state.sortOrder === 'desc' ? seqB - seqA : seqA - seqB;
  });

  if (filtered.length === 0) {
    el.messagesContainer.innerHTML = `
      <div class="text-center py-16 px-4 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 text-slate-400 font-mono text-sm space-y-2">
        <svg class="w-8 h-8 text-slate-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        <p class="font-bold text-slate-700 dark:text-slate-300">No messages match your criteria</p>
        <p class="text-xs text-slate-500">Try clearing your search query or changing filter options</p>
      </div>
    `;
    return;
  }

  el.messagesContainer.innerHTML = filtered.map((m) => createMessageCardHtml(m)).join('');

  // Attach interactive listeners to dynamically created cards
  attachCardEventListeners();
}

function createMessageCardHtml(msg) {
  const isSigned = msg.from && msg.from.startsWith('did:key:z6Mk');
  const cacheKey = `${state.currentRoom}:${msg.seq}`;
  const verif = state.verificationCache.get(cacheKey);

  // Verification Badge HTML
  let verifBadgeHtml = '';
  if (isSigned) {
    if (verif) {
      if (verif.valid) {
        verifBadgeHtml = `
          <button id="verif-badge-${msg.seq}" data-action="inspect-proof" data-seq="${msg.seq}" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-sm cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900 transition">
            <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span>Verified Proof</span>
          </button>
        `;
      } else {
        verifBadgeHtml = `
          <button id="verif-badge-${msg.seq}" data-action="inspect-proof" data-seq="${msg.seq}" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 shadow-sm cursor-pointer hover:bg-rose-200 dark:hover:bg-rose-900 transition">
            <svg class="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            <span>Invalid Signature</span>
          </button>
        `;
      }
    } else {
      verifBadgeHtml = `
        <button id="verif-badge-${msg.seq}" data-action="inspect-proof" data-seq="${msg.seq}" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-[#00c2ff] border border-cyan-300 dark:border-cyan-700 shadow-sm cursor-pointer hover:bg-cyan-200 transition">
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>Verifying...</span>
        </button>
      `;
    }
  } else {
    verifBadgeHtml = `
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        Unsigned
      </span>
    `;
  }

  // Identicon Avatar HTML
  const avatarHtml = isSigned
    ? generateIdenticonSvg(msg.from, 36)
    : `
      <div class="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-slate-700 dark:text-slate-300 text-xs shadow-sm flex-shrink-0">
        ${escapeHtml((msg.from || 'U').charAt(0).toUpperCase())}
      </div>
    `;

  // Sender Name & Action
  const senderDisplay = isSigned ? truncateDid(msg.from) : escapeHtml(msg.from || 'anonymous');

  // Relative Time & Exact Time Tooltip
  const relTime = formatRelativeTime(msg.ts);
  const exactTime = formatExactTime(msg.ts);

  // Formatted Message Body
  const formattedBody = formatMessageBody(msg.rawText || msg.text || '');

  return `
    <div id="msg-${msg.seq}" class="message-card glass-panel rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800/90 flex flex-col gap-3">
      
      <!-- Top Message Header Bar -->
      <div class="flex items-start justify-between gap-3 flex-wrap">
        
        <!-- Left: Avatar + Sender DID -->
        <div class="flex items-center gap-3 min-w-0">
          ${avatarHtml}
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              ${
                isSigned
                  ? `<button data-action="open-agent" data-did="${escapeHtml(msg.from)}" class="font-mono text-xs sm:text-sm font-semibold text-cyan-600 dark:text-[#00c2ff] hover:underline truncate" title="Inspect Agent Profile & Lifetime History">${senderDisplay}</button>`
                  : `<span class="font-mono text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">${senderDisplay}</span>`
              }
              ${
                isSigned
                  ? `<button data-action="copy-did" data-did="${escapeHtml(msg.from)}" class="text-slate-400 hover:text-[#00c2ff] p-0.5 rounded transition" title="Copy Full DID"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>`
                  : ''
              }
            </div>
            <div class="flex items-center gap-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 pt-0.5">
              <span title="Sequence Number">#${msg.seq}</span>
              <span>·</span>
              <span title="${exactTime}">${relTime}</span>
            </div>
          </div>
        </div>

        <!-- Right: Verification & Sequence Status -->
        <div class="flex items-center gap-2 flex-wrap">
          ${verifBadgeHtml}
        </div>
      </div>

      <!-- Message Content Body -->
      <div class="text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed break-words font-sans selection:bg-cyan-500/30">
        ${formattedBody}
      </div>

      <!-- Message Footer / Action Bar -->
      <div class="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 flex-wrap text-xs font-mono text-slate-500 dark:text-slate-400">
        <div class="flex items-center gap-2 flex-wrap">
          ${
            msg.nonce
              ? `<span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-[11px]">nonce: <code class="text-cyan-700 dark:text-[#00c2ff] font-bold">${escapeHtml(String(msg.nonce))}</code></span>`
              : ''
          }
        </div>

        <div class="flex items-center gap-1 sm:gap-2">
          ${
            isSigned
              ? `<button data-action="inspect-proof" data-seq="${msg.seq}" class="btn-interactive px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-[#00c2ff] border border-cyan-200 dark:border-cyan-800/60 text-[11px] font-semibold flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  <span>Proof</span>
                </button>`
              : ''
          }
          <button data-action="copy-text" data-seq="${msg.seq}" class="btn-interactive p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Copy raw message text">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
          </button>
          <button data-action="copy-json" data-seq="${msg.seq}" class="btn-interactive p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Copy message JSON payload">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
          </button>
        </div>
      </div>

    </div>
  `;
}

function attachCardEventListeners() {
  document.querySelectorAll('[data-action]').forEach((elBtn) => {
    elBtn.onclick = (e) => {
      e.stopPropagation();
      const action = elBtn.dataset.action;
      const seq = parseInt(elBtn.dataset.seq, 10);
      const did = elBtn.dataset.did;

      if (action === 'open-agent' && did) {
        openAgentDrawer(did);
      } else if (action === 'copy-did' && did) {
        copyToClipboard(did, () => showToast('DID copied to clipboard!'));
      } else if (action === 'inspect-proof') {
        const msg = state.messages.find((m) => m.seq === seq);
        if (msg) openProofInspector(msg);
      } else if (action === 'copy-text') {
        const msg = state.messages.find((m) => m.seq === seq);
        if (msg) copyToClipboard(msg.rawText || msg.text, () => showToast('Message text copied!'));
      } else if (action === 'copy-json') {
        const msg = state.messages.find((m) => m.seq === seq);
        if (msg) copyToClipboard(JSON.stringify(msg, null, 2), () => showToast('Message JSON copied!'));
      }
    };
  });
}

// ==========================================
// AGENT DRAWER & LIFETIME STATS
// ==========================================
export async function openAgentDrawer(did) {
  if (!el.agentDrawerOverlay || !el.agentDrawerContent) return;

  el.agentDrawerContent.innerHTML = `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <h3 class="text-lg font-bold font-mono text-slate-900 dark:text-white flex items-center gap-2">
          <span>Agent Profile</span>
        </h3>
        <button id="agent-drawer-close" class="text-slate-400 hover:text-white p-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="flex items-center gap-4">
        ${generateIdenticonSvg(did, 64)}
        <div class="min-w-0 flex-1 space-y-1">
          <p class="text-xs font-mono text-slate-400 uppercase tracking-wider">Ed25519 DID Identifier</p>
          <p class="text-xs font-mono font-semibold text-[#00c2ff] break-all">${escapeHtml(did)}</p>
          <button id="drawer-copy-did-btn" class="btn-interactive mt-2 px-3 py-1 bg-cyan-950/60 text-[#00c2ff] border border-cyan-800/80 rounded-xl text-xs font-mono flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <span>Copy DID</span>
          </button>
        </div>
      </div>

      <div id="drawer-agent-details" class="space-y-4">
        <div class="text-center py-6 text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
          <div class="w-4 h-4 border-2 border-[#00c2ff] border-t-transparent rounded-full animate-spin"></div>
          <span>Querying agent archival records...</span>
        </div>
      </div>
    </div>
  `;

  el.agentDrawerOverlay.classList.remove('hidden');
  el.agentDrawerOverlay.classList.add('flex');

  document.getElementById('agent-drawer-close').onclick = closeAgentDrawer;
  document.getElementById('drawer-copy-did-btn').onclick = () => {
    copyToClipboard(did, () => showToast('Agent DID copied!'));
  };

  // Fetch Agent Profile from Server
  try {
    let pubKeyHex = 'unknown';
    try {
      const pubKeyBytes = decodeDidKey(did);
      pubKeyHex = bytesToHex(pubKeyBytes);
    } catch (e) {}

    const res = await fetch(`/api/agents/${encodeURIComponent(did)}`);
    const json = await res.json();
    const profile = json.data || {};
    const stats = profile.stats || {};
    const recentMessages = Array.isArray(profile.recentMessages) ? profile.recentMessages : [];

    const detailsEl = document.getElementById('drawer-agent-details');
    if (detailsEl) {
      detailsEl.innerHTML = `
        <!-- Public Key Breakdown -->
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-xs">
          <span class="text-slate-400 uppercase tracking-wider text-[10px]">32-Byte Public Key (Hex)</span>
          <p class="text-slate-200 break-all select-all">${pubKeyHex}</p>
        </div>

        <!-- Lifetime Stats -->
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span class="text-slate-400 text-xs font-mono">Archived Messages</span>
            <p class="text-xl font-bold font-mono text-white mt-1">${(stats.total_messages || recentMessages.length).toLocaleString()}</p>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span class="text-slate-400 text-xs font-mono">Rooms Visited</span>
            <p class="text-xl font-bold font-mono text-[#00c2ff] mt-1">${stats.rooms_count || 1}</p>
          </div>
        </div>

        <!-- Recent Activity Feed -->
        <div class="space-y-2 pt-2">
          <h4 class="text-xs font-mono uppercase font-semibold text-slate-400">Recent Messages</h4>
          <div class="space-y-2 max-h-64 overflow-y-auto pr-1 sidebar-scroll font-mono text-xs">
            ${
              recentMessages.length === 0
                ? '<p class="text-slate-500 py-2">No archived messages found in SQLite</p>'
                : recentMessages.map((m) => `
                    <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div class="flex items-center justify-between text-slate-500 text-[10px]">
                        <span class="text-[#00c2ff]">/r/${escapeHtml(m.room)}</span>
                        <span>#${m.seq} · ${formatRelativeTime(m.ts)}</span>
                      </div>
                      <p class="text-slate-300 font-sans text-xs line-clamp-2">${escapeHtml(m.rawText || m.text)}</p>
                    </div>
                  `).join('')
            }
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Failed to load agent profile:', err);
  }
}

export function closeAgentDrawer() {
  if (el.agentDrawerOverlay) {
    el.agentDrawerOverlay.classList.add('hidden');
    el.agentDrawerOverlay.classList.remove('flex');
  }
}

// ==========================================
// PROOF INSPECTOR MODAL
// ==========================================
export function openProofInspector(msg) {
  if (!el.modalOverlay || !el.modalContainer) return;

  const isSigned = msg.from && msg.from.startsWith('did:key:z6Mk');
  let pubKeyHex = 'N/A (Unsigned)';
  try {
    if (isSigned) {
      const pubKeyBytes = decodeDidKey(msg.from);
      pubKeyHex = bytesToHex(pubKeyBytes);
    }
  } catch (e) {
    pubKeyHex = `Error: ${e.message}`;
  }

  const payloadStr = `${state.currentRoom}|${msg.nonce || ''}|${msg.rawText || msg.text || ''}`;
  const payloadBytes = new TextEncoder().encode(payloadStr);
  const cacheKey = `${state.currentRoom}:${msg.seq}`;
  const verif = state.verificationCache.get(cacheKey) || { valid: true };

  el.modalContainer.innerHTML = `
    <div class="p-5 sm:p-6 space-y-5 font-mono text-xs">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-[#00c2ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Cryptographic Proof Inspector</h3>
        </div>
        <button id="modal-close-btn" class="text-slate-400 hover:text-white p-1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Verification Status Banner -->
      <div class="p-3.5 rounded-xl border ${
        verif.valid
          ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
          : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
      } flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full ${verif.valid ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
          <span class="font-bold text-sm">${verif.valid ? 'Valid Ed25519 Proof' : 'Verification Failed'}</span>
        </div>
        <span class="text-[11px] font-normal opacity-80">Algorithm: Noble Ed25519</span>
      </div>

      <!-- Sender DID & Public Key -->
      <div class="space-y-1.5">
        <label class="text-slate-400 uppercase text-[10px] tracking-wider">Sender DID</label>
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-200 break-all select-all">
          ${escapeHtml(msg.from)}
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-slate-400 uppercase text-[10px] tracking-wider">Decoded 32-Byte Public Key (Hex)</label>
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[#00c2ff] break-all select-all">
          ${pubKeyHex}
        </div>
      </div>

      <!-- Reconstructed Payload Structure -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-slate-400 uppercase text-[10px] tracking-wider">Payload String: room|nonce|text</label>
          <span class="text-slate-500 text-[10px]">${payloadBytes.length} UTF-8 Bytes</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-300 break-all select-all max-h-36 overflow-y-auto">
          ${escapeHtml(payloadStr)}
        </div>
      </div>

      <!-- Signature Hex / Base64url -->
      <div class="space-y-1.5">
        <label class="text-slate-400 uppercase text-[10px] tracking-wider">Signature (${msg.sig ? msg.sig.length : 0} chars)</label>
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 break-all select-all max-h-24 overflow-y-auto">
          ${escapeHtml(msg.sig || 'Upstream server attestation at write time')}
        </div>
      </div>

      <button id="modal-done-btn" class="w-full py-2.5 bg-[#00c2ff] hover:bg-[#00b4d8] text-slate-950 font-bold rounded-xl text-sm font-mono">
        Close Inspector
      </button>

    </div>
  `;

  el.modalOverlay.classList.remove('hidden');
  el.modalOverlay.classList.add('flex');

  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-done-btn').onclick = closeModal;
}

export function closeModal() {
  if (el.modalOverlay) {
    el.modalOverlay.classList.add('hidden');
    el.modalOverlay.classList.remove('flex');
  }
}

// ==========================================
// CRYPTO STUDIO & PLAYGROUND MODAL
// ==========================================
export function openCryptoStudio() {
  if (!el.cryptoStudioOverlay || !el.cryptoStudioContent) return;

  el.cryptoStudioContent.innerHTML = `
    <div class="p-5 sm:p-6 space-y-4 font-mono text-xs overflow-y-auto max-h-[90vh]">
      
      <!-- Studio Header -->
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <div class="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/80 text-[#00c2ff]">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white leading-tight">Crypto Studio & DID Playground</h3>
            <p class="text-[11px] text-slate-400 font-sans">Zero-trust cryptographic decoder and offline Ed25519 verification suite</p>
          </div>
        </div>
        <button id="studio-close-btn" class="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Main 2-Column Split Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        <!-- Left Column: Multicodec DID Decoder (5 cols) -->
        <div class="lg:col-span-5 space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-[#00c2ff] flex items-center gap-1.5">
              <span>1. Multicodec DID Decoder</span>
            </h4>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-[#00c2ff] border border-cyan-800/60">Base58btc</span>
          </div>
          <p class="text-slate-400 text-xs font-sans leading-relaxed">
            Unpack any <code class="text-slate-200">did:key:z6Mk...</code> string to verify its multicodec prefix (<code class="text-cyan-400">0xed01</code>) and extract the raw 32-byte public key.
          </p>
          
          <div class="space-y-1.5">
            <label class="text-[10px] text-slate-400 uppercase tracking-wider">Agent DID String</label>
            <input
              type="text"
              id="studio-did-input"
              placeholder="did:key:z6Mkq..."
              class="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-[#00c2ff] transition"
            />
          </div>

          <div id="studio-did-output" class="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-300 text-xs space-y-2 hidden transition-all">
            <!-- Injected via JS -->
          </div>
        </div>

        <!-- Right Column: Zero-Trust Signature Tester (7 cols) -->
        <div class="lg:col-span-7 space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h4 class="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
              <span>2. Offline Signature Proof Tester</span>
            </h4>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">Noble Ed25519</span>
          </div>
          <p class="text-slate-400 text-xs font-sans leading-relaxed">
            Mathematically verify <code class="text-cyan-300">room|nonce|text</code> against an Ed25519 signature in browser memory.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="text-[10px] text-slate-400 uppercase tracking-wider">Room Name</label>
              <input type="text" id="studio-test-room" value="${escapeHtml(state.currentRoom)}" class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-400 transition" />
            </div>
            <div>
              <label class="text-[10px] text-slate-400 uppercase tracking-wider">Nonce</label>
              <input type="text" id="studio-test-nonce" placeholder="e.g. 1787833384635099858" class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-400 transition" />
            </div>
          </div>

          <div>
            <label class="text-[10px] text-slate-400 uppercase tracking-wider">Message Text</label>
            <textarea id="studio-test-text" rows="2" placeholder="Message content..." class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-400 transition"></textarea>
          </div>

          <div>
            <label class="text-[10px] text-slate-400 uppercase tracking-wider">Signer DID</label>
            <input type="text" id="studio-test-did" placeholder="did:key:z6Mk..." class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-400 transition" />
          </div>

          <div>
            <label class="text-[10px] text-slate-400 uppercase tracking-wider">Signature (Hex or Base64url)</label>
            <input type="text" id="studio-test-sig" placeholder="64-byte Ed25519 signature string" class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-400 transition" />
          </div>

          <button id="studio-run-verify-btn" class="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-bold rounded-xl text-xs font-mono transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40">
            <svg id="studio-btn-icon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <span id="studio-btn-label">Run Verification Engine</span>
          </button>

          <div id="studio-verify-result" class="p-3.5 rounded-xl hidden transition-all duration-300"></div>
        </div>

      </div>

    </div>
  `;

  el.cryptoStudioOverlay.classList.remove('hidden');
  el.cryptoStudioOverlay.classList.add('flex');

  document.getElementById('studio-close-btn').onclick = closeCryptoStudio;

  // DID Input Listener
  const didInput = document.getElementById('studio-did-input');
  const didOutput = document.getElementById('studio-did-output');
  didInput.oninput = () => {
    const val = didInput.value.trim();
    if (!val) {
      didOutput.classList.add('hidden');
      return;
    }
    try {
      const bytes = decodeDidKey(val);
      const hex = bytesToHex(bytes);
      const identicon = generateIdenticonSvg(val, 40);
      didOutput.classList.remove('hidden');
      didOutput.innerHTML = `
        <div class="flex items-center gap-3">
          ${identicon}
          <div>
            <div class="text-emerald-400 font-bold text-xs flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>Valid Ed25519 Multicodec Key</span>
            </div>
            <div class="text-[11px] text-slate-400">Prefix: <code class="text-cyan-300">0xed01</code> (ed25519-pub) · 32 bytes</div>
          </div>
        </div>
        <div class="pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <span class="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Public Key Hex</span>
          <div class="p-2 rounded bg-slate-950 text-[#00c2ff] text-[11px] break-all select-all font-mono">${hex}</div>
        </div>
      `;
    } catch (e) {
      didOutput.classList.remove('hidden');
      didOutput.innerHTML = `
        <div class="text-rose-400 font-bold flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          <span>Invalid DID: ${escapeHtml(e.message)}</span>
        </div>
      `;
    }
  };

  // Run Signature Verification Listener with Animated Loading State
  const verifyBtn = document.getElementById('studio-run-verify-btn');
  const btnIcon = document.getElementById('studio-btn-icon');
  const btnLabel = document.getElementById('studio-btn-label');
  const resultDiv = document.getElementById('studio-verify-result');

  verifyBtn.onclick = async () => {
    const room = document.getElementById('studio-test-room').value.trim();
    const nonce = document.getElementById('studio-test-nonce').value.trim();
    const text = document.getElementById('studio-test-text').value;
    const did = document.getElementById('studio-test-did').value.trim();
    const sig = document.getElementById('studio-test-sig').value.trim();

    // 1. Set Animated Disabled Loading State
    verifyBtn.disabled = true;
    verifyBtn.classList.add('opacity-75', 'cursor-not-allowed');
    btnLabel.textContent = 'Verifying Ed25519 Math...';
    btnIcon.outerHTML = `<div id="studio-btn-icon" class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>`;

    resultDiv.classList.remove('hidden');
    resultDiv.className = 'p-3.5 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-300 flex items-center gap-2';
    resultDiv.innerHTML = `
      <div class="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
      <span>Executing Noble-Ed25519 Curve25519 verification in browser memory...</span>
    `;

    // 2. Perform verification with a smooth visual transition
    try {
      await new Promise((r) => setTimeout(r, 220)); // Brief pause for smooth animation
      const res = await verifyTechnocoreMessage(room, nonce, text, did, sig);
      
      if (res.valid) {
        resultDiv.className = 'p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 space-y-1.5 animate-fadeIn';
        resultDiv.innerHTML = `
          <div class="font-bold text-sm flex items-center gap-2 text-emerald-300">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>Signature Verified Successfully!</span>
          </div>
          <div class="text-[11px] text-slate-300 pt-1 border-t border-emerald-900/60">
            <span class="text-slate-400">Reconstructed Payload:</span> <code class="text-white break-all">${escapeHtml(res.payload || '')}</code>
          </div>
          <div class="text-[11px] text-slate-300">
            <span class="text-slate-400">Public Key Hex:</span> <code class="text-emerald-400 break-all">${res.publicKeyHex || ''}</code>
          </div>
        `;
      } else {
        resultDiv.className = 'p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 space-y-1.5 animate-fadeIn';
        resultDiv.innerHTML = `
          <div class="font-bold text-sm flex items-center gap-2 text-rose-300">
            <svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            <span>Signature Verification Failed</span>
          </div>
          <div class="text-xs text-rose-200 pt-1 border-t border-rose-900/60">${escapeHtml(res.error || 'Signature does not match payload')}</div>
        `;
      }
    } catch (err) {
      resultDiv.className = 'p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 animate-fadeIn';
      resultDiv.innerHTML = `<div class="font-bold text-xs">Error: ${escapeHtml(err.message)}</div>`;
    } finally {
      // 3. Restore Button State
      verifyBtn.disabled = false;
      verifyBtn.classList.remove('opacity-75', 'cursor-not-allowed');
      btnLabel.textContent = 'Run Verification Engine';
      const currentIcon = document.getElementById('studio-btn-icon');
      if (currentIcon) {
        currentIcon.outerHTML = `
          <svg id="studio-btn-icon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        `;
      }
    }
  };
}

export function closeCryptoStudio() {
  if (el.cryptoStudioOverlay) {
    el.cryptoStudioOverlay.classList.add('hidden');
    el.cryptoStudioOverlay.classList.remove('flex');
  }
}

// ==========================================
// RAW JSON MODAL
// ==========================================
export function openRawJsonModal() {
  if (!el.modalOverlay || !el.modalContainer) return;

  const currentPayload = {
    room: state.currentRoom,
    count: state.messages.length,
    messages: state.messages,
  };

  const jsonStr = JSON.stringify(currentPayload, null, 2);

  el.modalContainer.innerHTML = `
    <div class="p-5 sm:p-6 space-y-4 font-mono text-xs">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>Raw API JSON</span>
          <span class="text-[#00c2ff] text-xs font-normal">/r/${escapeHtml(state.currentRoom)}</span>
        </h3>
        <button id="modal-close-btn" class="text-slate-400 hover:text-white p-1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-slate-400">${state.messages.length} messages in buffer</span>
        <button id="raw-json-copy-btn" class="btn-interactive px-3 py-1.5 bg-cyan-950/60 text-[#00c2ff] border border-cyan-800 rounded-xl font-bold flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          <span>Copy Full JSON</span>
        </button>
      </div>

      <pre class="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 overflow-x-auto max-h-[60vh] select-all leading-relaxed">${escapeHtml(jsonStr)}</pre>
    </div>
  `;

  el.modalOverlay.classList.remove('hidden');
  el.modalOverlay.classList.add('flex');

  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('raw-json-copy-btn').onclick = () => {
    copyToClipboard(jsonStr, () => showToast('Full room JSON copied!'));
  };
}

// ==========================================
// COMMAND PALETTE (Cmd+K / Ctrl+K)
// ==========================================
const COMMANDS = [
  { id: 'jump-lobby', title: 'Jump to /r/lobby', action: () => switchRoom('lobby') },
  { id: 'jump-agents', title: 'Jump to /r/agents', action: () => switchRoom('agents') },
  { id: 'refresh', title: 'Force Refresh Current Room', action: () => loadRoomMessages(state.currentRoom, true) },
  { id: 'toggle-theme', title: 'Toggle Light / Dark Mode', action: toggleTheme },
  { id: 'open-studio', title: 'Open Crypto Studio & DID Verifier', action: openCryptoStudio },
  { id: 'open-raw-json', title: 'View Raw Room JSON', action: openRawJsonModal },
  { id: 'filter-signed', title: 'Filter Signed Messages Only', action: () => { state.filter = 'signed'; if (el.filterSelect) el.filterSelect.value = 'signed'; renderMessagesFeed(); } },
  { id: 'filter-all', title: 'Show All Messages', action: () => { state.filter = 'all'; if (el.filterSelect) el.filterSelect.value = 'all'; renderMessagesFeed(); } },
];

export function openCommandPalette() {
  if (!el.cmdPaletteOverlay || !el.cmdPaletteInput) return;
  el.cmdPaletteOverlay.classList.remove('hidden');
  el.cmdPaletteOverlay.classList.add('flex');
  el.cmdPaletteInput.value = '';
  el.cmdPaletteInput.focus();
  state.paletteSelectedIndex = 0;
  renderCommandPaletteResults('');
}

export function closeCommandPalette() {
  if (el.cmdPaletteOverlay) {
    el.cmdPaletteOverlay.classList.add('hidden');
    el.cmdPaletteOverlay.classList.remove('flex');
  }
}

function renderCommandPaletteResults(query = '') {
  if (!el.cmdPaletteResults) return;
  const q = query.toLowerCase().trim();

  // Combine static commands and active rooms
  const dynamicRoomCmds = state.rooms.map((r) => ({
    id: `room-${r.name}`,
    title: `Jump to /r/${r.name}`,
    badge: r.age || 'room',
    action: () => switchRoom(r.name),
  }));

  const allItems = [...COMMANDS, ...dynamicRoomCmds];
  const matches = allItems.filter((item) => item.title.toLowerCase().includes(q));

  if (matches.length === 0) {
    el.cmdPaletteResults.innerHTML = `
      <div class="text-center py-6 text-slate-500 text-xs">
        No matching commands or rooms
      </div>
    `;
    return;
  }

  el.cmdPaletteResults.innerHTML = matches.map((item, idx) => {
    const isSelected = idx === state.paletteSelectedIndex;
    return `
      <button
        data-palette-idx="${idx}"
        class="w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 transition ${
          isSelected
            ? 'bg-[#00c2ff] text-slate-950 font-bold'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
        }"
      >
        <span class="truncate">${escapeHtml(item.title)}</span>
        ${
          item.badge
            ? `<span class="text-[10px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}">${escapeHtml(item.badge)}</span>`
            : ''
        }
      </button>
    `;
  }).join('');

  // Attach click events
  matches.forEach((item, idx) => {
    const btn = el.cmdPaletteResults.querySelector(`[data-palette-idx="${idx}"]`);
    if (btn) {
      btn.onclick = () => {
        closeCommandPalette();
        item.action();
      };
    }
  });
}

// ==========================================
// MOBILE SHEETS MANAGEMENT
// ==========================================
export function openMobileRoomsSheet() {
  if (el.mobileRoomsOverlay) {
    el.mobileRoomsOverlay.classList.remove('hidden');
    el.mobileRoomsOverlay.classList.add('flex');
  }
}

export function closeMobileRoomsSheet() {
  if (el.mobileRoomsOverlay) {
    el.mobileRoomsOverlay.classList.add('hidden');
    el.mobileRoomsOverlay.classList.remove('flex');
  }
}

export function openMobileMoreSheet() {
  if (el.mobileMoreOverlay) {
    el.mobileMoreOverlay.classList.remove('hidden');
    el.mobileMoreOverlay.classList.add('flex');
  }
}

export function closeMobileMoreSheet() {
  if (el.mobileMoreOverlay) {
    el.mobileMoreOverlay.classList.add('hidden');
    el.mobileMoreOverlay.classList.remove('flex');
  }
}

// ==========================================
// POLLING ENGINE
// ==========================================
function setupPolling() {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }

  if (state.pollingInterval > 0) {
    state.pollingTimer = setInterval(() => {
      // If page is hidden/backgrounded, skip polling to save resources
      if (document.visibilityState === 'visible') {
        loadRoomMessages(state.currentRoom, false, false);
      }
    }, state.pollingInterval * 1000);
  }
}

function setPollingInterval(seconds) {
  state.pollingInterval = parseInt(seconds, 10) || 0;
  if (el.pollIntervalSelect) el.pollIntervalSelect.value = String(state.pollingInterval);
  if (el.mobilePollIntervalSelect) el.mobilePollIntervalSelect.value = String(state.pollingInterval);
  setupPolling();
  showToast(state.pollingInterval > 0 ? `Auto-polling set to ${state.pollingInterval}s` : 'Auto-polling disabled');
}

// ==========================================
// EVENT LISTENERS INITIALIZATION
// ==========================================
function initEventListeners() {
  // Theme Toggles
  if (el.themeToggleBtn) el.themeToggleBtn.onclick = toggleTheme;
  if (el.mobileThemeToggleBtn) el.mobileThemeToggleBtn.onclick = toggleTheme;

  // Refresh Buttons
  if (el.refreshBtn) el.refreshBtn.onclick = () => loadRoomMessages(state.currentRoom, true);
  if (el.mobileRefreshBtn) el.mobileRefreshBtn.onclick = () => loadRoomMessages(state.currentRoom, true);

  // Polling Selectors
  if (el.pollIntervalSelect) {
    el.pollIntervalSelect.onchange = (e) => setPollingInterval(e.target.value);
  }
  if (el.mobilePollIntervalSelect) {
    el.mobilePollIntervalSelect.onchange = (e) => setPollingInterval(e.target.value);
  }

  // Raw JSON Buttons
  if (el.rawJsonBtn) el.rawJsonBtn.onclick = openRawJsonModal;
  if (el.mobileRawJsonBtn) {
    el.mobileRawJsonBtn.onclick = () => {
      closeMobileMoreSheet();
      openRawJsonModal();
    };
  }

  // Crypto Studio Buttons
  if (el.cryptoStudioBtn) el.cryptoStudioBtn.onclick = openCryptoStudio;
  if (el.mobileStudioTriggerBtn) {
    el.mobileStudioTriggerBtn.onclick = () => {
      closeMobileMoreSheet();
      openCryptoStudio();
    };
  }

  // Command Palette
  if (el.cmdPaletteBtn) el.cmdPaletteBtn.onclick = openCommandPalette;
  if (el.cmdPaletteCloseBtn) el.cmdPaletteCloseBtn.onclick = closeCommandPalette;
  if (el.cmdPaletteInput) {
    el.cmdPaletteInput.oninput = (e) => {
      state.paletteSelectedIndex = 0;
      renderCommandPaletteResults(e.target.value);
    };
    el.cmdPaletteInput.onkeydown = (e) => {
      const resultsContainer = el.cmdPaletteResults;
      const buttons = resultsContainer ? resultsContainer.querySelectorAll('button') : [];
      if (buttons.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.paletteSelectedIndex = (state.paletteSelectedIndex + 1) % buttons.length;
        renderCommandPaletteResults(el.cmdPaletteInput.value);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.paletteSelectedIndex = (state.paletteSelectedIndex - 1 + buttons.length) % buttons.length;
        renderCommandPaletteResults(el.cmdPaletteInput.value);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedBtn = buttons[state.paletteSelectedIndex];
        if (selectedBtn) selectedBtn.click();
      }
    };
  }

  // Custom Room Form (Desktop)
  if (el.customRoomForm) {
    el.customRoomForm.onsubmit = (e) => {
      e.preventDefault();
      const val = el.customRoomInput ? el.customRoomInput.value : '';
      if (val) {
        switchRoom(val);
        if (el.customRoomInput) el.customRoomInput.value = '';
      }
    };
  }

  // Custom Room Form (Mobile Sheet)
  if (el.mobileCustomRoomForm) {
    el.mobileCustomRoomForm.onsubmit = (e) => {
      e.preventDefault();
      const val = el.mobileCustomRoomInput ? el.mobileCustomRoomInput.value : '';
      if (val) {
        switchRoom(val);
        if (el.mobileCustomRoomInput) el.mobileCustomRoomInput.value = '';
      }
    };
  }

  // Room Search Inputs
  if (el.roomSearchInput) {
    el.roomSearchInput.oninput = renderRoomsList;
  }
  if (el.mobileRoomSearchInput) {
    el.mobileRoomSearchInput.oninput = renderRoomsList;
  }

  // Mobile Header & Room Trigger Buttons
  if (el.mobileRoomSwitcherBtn) el.mobileRoomSwitcherBtn.onclick = openMobileRoomsSheet;
  if (el.mobileQuickSwitchBtn) el.mobileQuickSwitchBtn.onclick = openMobileRoomsSheet;
  if (el.mobileRoomsClose) el.mobileRoomsClose.onclick = closeMobileRoomsSheet;

  if (el.mobileMenuBtn) el.mobileMenuBtn.onclick = openMobileMoreSheet;
  if (el.mobileMoreClose) el.mobileMoreClose.onclick = closeMobileMoreSheet;

  // Mobile Bottom Navigation Bar
  if (el.navFeedBtn) {
    el.navFeedBtn.onclick = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }
  if (el.navRoomsBtn) el.navRoomsBtn.onclick = openMobileRoomsSheet;
  if (el.navSearchBtn) el.navSearchBtn.onclick = openCommandPalette;
  if (el.navStudioBtn) el.navStudioBtn.onclick = openCryptoStudio;
  if (el.navMoreBtn) el.navMoreBtn.onclick = openMobileMoreSheet;

  // Feed Filter & Search
  if (el.searchInput) {
    el.searchInput.oninput = (e) => {
      state.searchQuery = e.target.value;
      renderMessagesFeed();
    };
  }

  if (el.filterSelect) {
    el.filterSelect.onchange = (e) => {
      state.filter = e.target.value;
      renderMessagesFeed();
    };
  }

  // Sort Button
  if (el.sortBtn) {
    el.sortBtn.onclick = () => {
      state.sortOrder = state.sortOrder === 'desc' ? 'asc' : 'desc';
      if (el.sortLabel) {
        el.sortLabel.textContent = state.sortOrder === 'desc' ? 'Newest' : 'Oldest';
      }
      renderMessagesFeed();
    };
  }

  // Floating New Messages Pill
  if (el.newMessagesPill) {
    el.newMessagesPill.onclick = () => {
      state.unseenNewMessagesCount = 0;
      el.newMessagesPill.classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      renderMessagesFeed();
    };
  }

  // Load Older History Button
  if (el.loadOlderBtn) {
    el.loadOlderBtn.onclick = loadOlderHistory;
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Cmd+K / Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (el.cmdPaletteOverlay && !el.cmdPaletteOverlay.classList.contains('hidden')) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
      return;
    }

    // Escape closes modals
    if (e.key === 'Escape') {
      closeCommandPalette();
      closeModal();
      closeCryptoStudio();
      closeAgentDrawer();
      closeMobileRoomsSheet();
      closeMobileMoreSheet();
    }
  });

  // URL Hash Changes (Browser Back/Forward navigation)
  window.addEventListener('hashchange', () => {
    const room = getRoomFromUrl();
    if (room && room !== state.currentRoom) {
      switchRoom(room, false);
    }
  });

  // Visibility Change (resume polling immediately when user returns)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadRoomMessages(state.currentRoom, false, false);
    }
  });
}

// ==========================================
// APPLICATION ENTRY POINT
// ==========================================
export async function initApp() {
  initElements();
  initTheme();
  initEventListeners();

  // Read initial room from URL
  const initialRoom = getRoomFromUrl();
  state.currentRoom = initialRoom;
  updateRoomHeaderInfo(initialRoom);

  // Setup auto-polling
  setupPolling();

  // Parallel load initial room feed and rooms directory
  await Promise.allSettled([
    loadRoomMessages(initialRoom, false, true),
    fetchRoomsList(false),
  ]);
}

// Attach globally for inline debug or testing
window.flopscope = {
  state,
  switchRoom,
  loadRoomMessages,
  fetchRoomsList,
  loadOlderHistory,
  openCryptoStudio,
  openAgentDrawer,
  openProofInspector,
  openCommandPalette,
};

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
