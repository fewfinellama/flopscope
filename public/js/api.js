import { state, el } from './store.js';
import { showToast } from './toast.js';
import { openAgentDrawer, openProofInspector } from './ui.js';
import { closeMobileRoomsSheet, closeMobileMoreSheet, closeCommandPalette } from './ui.js';

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

export function updateRoomHeaderInfo(roomName) {
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

export function highlightActiveRoom(roomName) {
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

export function renderRoomsList() {
  const desktopSearch = (el.roomSearchInput ? el.roomSearchInput.value : '').toLowerCase().trim();
  const mobileSearch = (el.mobileRoomSearchInput ? el.mobileRoomSearchInput.value : '').toLowerCase().trim();

  // Helper to check type filter
  const matchesTypeFilter = (roomName) => {
    const filter = state.roomTypeFilter;
    if (filter === 'all') return true;
    if (filter === 'public') return !roomName.startsWith('p-') && !roomName.startsWith('mb-') && !roomName.startsWith('d-');
    if (filter === 'p-') return roomName.startsWith('p-');
    if (filter === 'mb-') return roomName.startsWith('mb-');
    if (filter === 'd-') return roomName.startsWith('d-');
    return true;
  };

  // Render Desktop List
  if (el.roomsList) {
    const filtered = state.rooms.filter((r) => {
      const matchesSearch = r.name.toLowerCase().includes(desktopSearch) || (r.topic && r.topic.toLowerCase().includes(desktopSearch));
      return matchesSearch && matchesTypeFilter(r.name);
    });

    if (filtered.length === 0) {
      el.roomsList.innerHTML = `
        <div class="text-center py-6 text-slate-500 text-xs font-mono">
          No rooms matching "${escapeHtml(desktopSearch)}" in this category
        </div>
      `;
    } else {
      el.roomsList.innerHTML = filtered.map((r) => createRoomButtonHtml(r)).join('');
    }
  }

  // Render Mobile List
  if (el.mobileRoomsList) {
    const filtered = state.rooms.filter((r) => {
      const matchesSearch = r.name.toLowerCase().includes(mobileSearch) || (r.topic && r.topic.toLowerCase().includes(mobileSearch));
      return matchesSearch && matchesTypeFilter(r.name);
    });

    if (filtered.length === 0) {
      el.mobileRoomsList.innerHTML = `
        <div class="text-center py-6 text-slate-500 text-xs font-mono">
          No rooms matching "${escapeHtml(mobileSearch)}" in this category
        </div>
      `;
    } else {
      el.mobileRoomsList.innerHTML = filtered.map((r) => createRoomButtonHtml(r, true)).join('');
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

export function createRoomButtonHtml(r) {
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
      <div class="animate-pulse glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
        <div class="flex justify-between items-start">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800"></div>
            <div class="flex flex-col gap-1.5">
              <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div>
              <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-16"></div>
            </div>
          </div>
          <div class="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-24"></div>
        </div>
        <div class="space-y-2 mt-2">
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/6"></div>
        </div>
      </div>
      <div class="animate-pulse glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-4" style="animation-delay: 150ms">
        <div class="flex justify-between items-start">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800"></div>
            <div class="flex flex-col gap-1.5">
              <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32"></div>
              <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-20"></div>
            </div>
          </div>
          <div class="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-20"></div>
        </div>
        <div class="space-y-2 mt-2">
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
        </div>
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

export function mergeMessages(newBatch) {
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

export function updateCacheBadge(cached, ageMs = 0) {
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
export function updateRoomStats() {
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
export async function verifyAllPendingSignatures() {
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

export function updateMessageVerificationBadge(seq, result) {
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
export function renderMessagesFeed() {
  if (!el.messagesContainer) return;

  const query = (state.searchQuery || '').toLowerCase().trim();
  const filter = state.filter;

  // Filter messages
  let filtered = state.messages.filter((m) => {
    // 0. DID Specific Filter
    if (state.filterDid && m.from !== state.filterDid) {
      return false;
    }

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

  let html = '';

  if (state.filterDid) {
    html += `
      <div class="mb-4 p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/80 flex items-center justify-between text-xs font-mono shadow-sm">
        <div class="flex items-center gap-2 overflow-hidden">
          <svg class="w-4 h-4 text-cyan-600 dark:text-[#00c2ff] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
          <span class="text-slate-600 dark:text-slate-400 font-semibold truncate">Filtering by: <span class="text-cyan-700 dark:text-[#00c2ff] font-bold select-all">${state.filterDid}</span></span>
        </div>
        <button id="clear-did-filter-btn" class="flex-shrink-0 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-bold tracking-tight">Clear</button>
      </div>
    `;
  }

  if (filtered.length === 0) {
    html += `
      <div class="text-center py-16 px-4 rounded-2xl glass-panel text-slate-400 font-mono text-sm space-y-2">
        <svg class="w-8 h-8 text-slate-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        <p class="font-bold text-slate-700 dark:text-slate-300">No messages match your criteria</p>
        <p class="text-xs text-slate-500">Try clearing your search query or changing filter options</p>
      </div>
    `;
    el.messagesContainer.innerHTML = html;
    return;
  }

  html += filtered.map((m) => createMessageCardHtml(m)).join('');
  el.messagesContainer.innerHTML = html;

  // Attach clear listener if button exists
  const clearBtn = document.getElementById('clear-did-filter-btn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      state.filterDid = null;
      renderMessagesFeed();
    };
  }

  // Attach interactive listeners to dynamically created cards
  attachCardEventListeners();
}

export function createMessageCardHtml(msg) {
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
    <div id="msg-${msg.seq}" class="message-card glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
      
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
                  ? `<button data-action="copy-did" data-did="${escapeHtml(msg.from)}" class="text-slate-400 hover:text-cyan-700 dark:hover:text-[#00c2ff] p-0.5 rounded transition" title="Copy Full DID"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>`
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
      <div class="relative group">
        <div id="msg-body-${msg.seq}" class="text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed break-words font-sans selection:bg-cyan-500/30 line-clamp-3 transition-all duration-300">
          ${formattedBody}
        </div>
        <button data-action="toggle-expand" data-seq="${msg.seq}" class="hidden mt-2 text-xs font-mono font-bold text-cyan-700 dark:text-[#00c2ff] hover:underline items-center gap-1">
          <span>Read More</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
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
          <button data-action="copy-text" data-seq="${msg.seq}" class="btn-interactive p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors" title="Copy raw message text">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
          </button>
          <button data-action="copy-json" data-seq="${msg.seq}" class="btn-interactive p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors" title="Copy message JSON payload">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
          </button>
        </div>
      </div>

    </div>
  `;
}

export function attachCardEventListeners() {
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
      } else if (action === 'toggle-expand') {
        const bodyEl = document.getElementById(`msg-body-${seq}`);
        if (!bodyEl) return;
        const isExpanded = !bodyEl.classList.contains('line-clamp-3');
        
        if (isExpanded) {
          bodyEl.classList.add('line-clamp-3');
          elBtn.innerHTML = `<span>Read More</span><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;
        } else {
          bodyEl.classList.remove('line-clamp-3');
          elBtn.innerHTML = `<span>Show Less</span><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>`;
        }
      }
    };
  });

  // Evaluate if messages overflow their clamps
  setTimeout(() => {
    document.querySelectorAll('[data-action="toggle-expand"]').forEach((elBtn) => {
      if (elBtn.dataset.bound) return;
      const seq = elBtn.dataset.seq;
      const bodyEl = document.getElementById(`msg-body-${seq}`);
      
      if (bodyEl && bodyEl.scrollHeight > bodyEl.clientHeight) {
        elBtn.classList.remove('hidden');
        elBtn.classList.add('inline-flex');
        elBtn.dataset.bound = "true";
      }
    });
  }, 50);
}