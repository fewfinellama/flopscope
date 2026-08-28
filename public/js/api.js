import { analyzeDids } from './did-analyzer.js';
import { computeRoomHealth } from './health-scorer.js';
import { state, el } from './store.js';
import { showToast } from './toast.js';
import { openAgentDrawer, openProofInspector, closeAgentDrawer } from './ui.js';
import { applyUsefulnessFilter } from './filters.js';
import { runProbes } from './protocol-probes.js';
import { saveRoomSnapshot, getRoomSnapshots, generateSparklineSvg } from './snapshots.js';
import { isBoilerplate } from './farming-patterns.js';
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
  exportDataAsJson,
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
  state.messages = []; // CRITICAL: Clear old room's messages!
  state.verificationCache.clear(); // Clear cryptographic verification cache for the new room
  state.unseenNewMessagesCount = 0;
  state.hasReachedHistoryEnd = false;
  state.lastFetchedSeq = null;

    // Clear sidebar search boxes so it doesn't stay stuck on empty state
  if (el.roomSearchInput) el.roomSearchInput.value = '';
  if (el.mobileRoomSearchInput) el.mobileRoomSearchInput.value = '';

  // Clean up any old jumped rooms that aren't the one we are in now
  state.rooms = state.rooms.filter(r => r.topic !== 'Discovered via Jump');

  // Inject room into list if it's new so it immediately appears in the sidebar
  if (!state.rooms.find((r) => r.name === cleanName)) {
    state.rooms.unshift({ name: cleanName, topic: 'Discovered via Jump', active: true });
  }

  
  if (typeof renderRoomsList === 'function') {
    renderRoomsList();
  }

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
      btn.classList.remove('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-600', 'dark:text-slate-300');
    } else {
      btn.classList.remove('bg-cyan-500/15', 'border-cyan-500/40', 'text-[#00c2ff]');
      btn.classList.add('bg-slate-100', 'dark:bg-slate-900/60', 'text-slate-600', 'dark:text-slate-300');
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

    // Ensure the current jumped room doesn't vanish on poll if it's dead
    if (state.currentRoom && !state.rooms.find(r => r.name === state.currentRoom)) {
      state.rooms.unshift({ name: state.currentRoom, topic: 'Discovered via Jump', active: true });
    }

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
    }).sort((a, b) => {
      const aPinned = state.pinnedRooms && state.pinnedRooms.has(a.name);
      const bPinned = state.pinnedRooms && state.pinnedRooms.has(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    if (filtered.length === 0) {
      if (desktopSearch.length > 0) {
        const targetRoom = escapeHtml(desktopSearch).replace(/[^a-z0-9-]/gi, '');
        el.roomsList.innerHTML = `
          <div class="text-center py-6 text-slate-500 text-xs font-mono space-y-3">
            <p>No active rooms matching "${escapeHtml(desktopSearch)}"</p>
            <button data-room="${targetRoom}" class="room-nav-btn btn-interactive px-4 py-2 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-[#00c2ff] border border-cyan-200 dark:border-cyan-800 rounded-xl font-bold font-mono inline-flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Jump to /r/${targetRoom}
            </button>
          </div>
        `;
      } else {
        el.roomsList.innerHTML = `
          <div class="text-center py-6 text-slate-500 text-xs font-mono">
            No rooms matching in this category
          </div>
        `;
      }
    } else {
      el.roomsList.innerHTML = filtered.map((r) => createRoomButtonHtml(r)).join('');
    }
  }

  // Render Mobile List
  if (el.mobileRoomsList) {
    const filtered = state.rooms.filter((r) => {
      const matchesSearch = r.name.toLowerCase().includes(mobileSearch) || (r.topic && r.topic.toLowerCase().includes(mobileSearch));
      return matchesSearch && matchesTypeFilter(r.name);
    }).sort((a, b) => {
      const aPinned = state.pinnedRooms && state.pinnedRooms.has(a.name);
      const bPinned = state.pinnedRooms && state.pinnedRooms.has(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    if (filtered.length === 0) {
      if (mobileSearch.length > 0) {
        const targetRoom = escapeHtml(mobileSearch).replace(/[^a-z0-9-]/gi, '');
        el.mobileRoomsList.innerHTML = `
          <div class="text-center py-6 text-slate-500 text-xs font-mono space-y-3">
            <p>No active rooms matching "${escapeHtml(mobileSearch)}"</p>
            <button data-room="${targetRoom}" class="room-nav-btn btn-interactive px-4 py-2 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-[#00c2ff] border border-cyan-200 dark:border-cyan-800 rounded-xl font-bold font-mono inline-flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Jump to /r/${targetRoom}
            </button>
          </div>
        `;
      } else {
        el.mobileRoomsList.innerHTML = `
          <div class="text-center py-6 text-slate-500 text-xs font-mono">
            No rooms matching in this category
          </div>
        `;
      }
    } else {
      el.mobileRoomsList.innerHTML = filtered.map((r) => createRoomButtonHtml(r, true)).join('');
    }
  }

  // Attach click listeners to room buttons
  document.querySelectorAll('.room-nav-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      const room = btn.dataset.room;
      if (room) switchRoom(room);
    };
  });

  // Attach click listeners to pin buttons
  document.querySelectorAll('.pin-room-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const room = btn.dataset.pinRoom;
      if (!room) return;
      
      if (!state.pinnedRooms) state.pinnedRooms = new Set();
      
      if (state.pinnedRooms.has(room)) {
        state.pinnedRooms.delete(room);
      } else {
        state.pinnedRooms.add(room);
      }
      
      localStorage.setItem('flopscope_pinned_rooms', JSON.stringify([...state.pinnedRooms]));
      renderRoomsList();
    };
  });
}

export function createRoomButtonHtml(r, isMobile = false) {
  const isActive = r.name === state.currentRoom;
  const isPinned = state.pinnedRooms && state.pinnedRooms.has(r.name);
  
  const activeClass = isActive
    ? 'bg-cyan-500/15 border-cyan-500/40 text-[#00c2ff] font-semibold'
    : isPinned
    ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 font-medium'
    : 'bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300';

  const pinIconColor = isPinned ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500';

  return `
    <div class="group relative block w-full">
      <button
        data-room="${escapeHtml(r.name)}"
        class="room-nav-btn w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 text-left transition-all duration-150 flex flex-col gap-1.5 ${activeClass}"
      >
        <div class="flex items-start justify-between gap-2 w-full">
          <div class="flex flex-col gap-1 min-w-0">
            <span class="font-mono text-sm tracking-tight truncate flex items-center gap-1.5">
              <span class="${isActive ? 'text-cyan-500 dark:text-[#00c2ff]' : 'text-slate-400 dark:text-slate-500'} font-bold">/r/</span>${escapeHtml(r.name)}
            </span>
            <span class="text-[11px] font-mono text-slate-400 dark:text-slate-500 flex-shrink-0">
              ${escapeHtml(r.age || 'live')}
            </span>
          </div>
          <div class="flex-shrink-0">
            <div
              data-pin-room="${escapeHtml(r.name)}" 
              class="pin-room-btn p-1.5 -m-1.5 rounded-lg transition-all cursor-pointer ${pinIconColor}" 
              title="${isPinned ? 'Unpin Room' : 'Pin Room'}"
            >
              <svg class="w-4 h-4" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
              </svg>
            </div>
          </div>
        </div>
        ${
          r.topic
            ? `<p class="text-xs text-slate-500 dark:text-slate-400 truncate w-full mt-0.5">${escapeHtml(r.topic)}</p>`
            : ''
        }
        <div class="flex items-center gap-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 pt-0.5">
          <span>seq ${r.seq || 0}</span>
        </div>
      </button>
    </div>
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
        const newMessages = incomingMessages.filter((m) => (m.seq || 0) > currentHighestSeq);
        const newCount = newMessages.length;
        const isNearTop = window.scrollY < 200;

        if (!isNearTop) {
          state.unseenNewMessagesCount += newCount;
          if (el.newMessagesPill && el.newMessagesCount) {
            el.newMessagesCount.textContent = `${state.unseenNewMessagesCount} new message${state.unseenNewMessagesCount > 1 ? 's' : ''}`;
            el.newMessagesPill.classList.remove('hidden');
          }
        }

        // Check for Watched DIDs
        if (state.watchedDids && state.watchedDids.size > 0) {
          for (const msg of newMessages) {
            const did = msg.from || msg.did;
            if (did && state.watchedDids.has(did) && !isBoilerplate(msg.text || '')) {
              const shortDid = truncateDid(did);
              const txt = (msg.text || '').substring(0, 40) + '...';
              showToast(`👀 ${shortDid} posted: "${txt}"`);
              if (Notification.permission === 'granted') {
                new Notification(`Watched DID: ${shortDid}`, {
                  body: msg.text || '',
                  icon: '/favicon.ico'
                });
              }
            }
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

    // Run protocol probes — throttled to every 10 successful polls to protect CPU
    state._probeCounter = (state._probeCounter || 0) + 1;
    if (state._probeCounter % 10 === 1 || isInitial) {
      const prevCount = state.lastPollMessageCount;
      const newCount = incomingMessages.length;
      state.lastPollMessageCount = newCount;
      const newSinceLastPoll = prevCount !== null ? Math.max(0, newCount - (prevCount || 0)) : null;
      state.protocolHealth = runProbes({
        messages: state.messages,
        room: roomName,
        newMessagesSinceLastPoll: newSinceLastPoll,
      });
      updateProtocolPill();
    }

    if (forceRefresh) {
      showToast(`Refreshed /r/${roomName}`);
    }
  } catch (err) {
    console.error('Failed to load room messages:', err);
    if (isInitial && el.messagesContainer) {
      el.messagesContainer.innerHTML = `
        <div class="text-center py-16 px-4 rounded-2xl glass-panel border border-rose-500/20 dark:border-rose-500/10 bg-rose-50/50 dark:bg-rose-950/10 flex flex-col items-center justify-center space-y-4 overflow-hidden">
          <div class="p-4 bg-rose-100 dark:bg-rose-900/30 rounded-full text-rose-500 dark:text-rose-400 mb-2">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div class="space-y-1">
            <h3 class="font-bold text-lg text-slate-800 dark:text-slate-200 tracking-tight">Connection Failed</h3>
            <p class="text-sm font-mono text-rose-600 dark:text-rose-400">Failed to load /r/${escapeHtml(roomName)}</p>
            <p class="text-xs font-mono text-slate-500 dark:text-slate-500 bg-white/50 dark:bg-black/20 py-1 px-3 rounded-lg inline-block mt-2">${escapeHtml(err.message)}</p>
          </div>
          <button id="error-retry-btn" class="mt-4 px-5 py-2.5 bg-[#00c2ff] hover:bg-[#009bcf] text-white rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 w-40">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Retry
          </button>
        </div>
      `;
      const retryBtn = document.getElementById('error-retry-btn');
      if (retryBtn) {
        retryBtn.onclick = () => {
          retryBtn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Retrying...';
          retryBtn.disabled = true;
          retryBtn.classList.add('opacity-75', 'cursor-not-allowed');
          
          // Small delay before fetching so the user actually sees the button state change
          setTimeout(() => {
            loadRoomMessages(roomName, true, false).then(() => {
              // Now we manually fetch rooms too because the sidebar might be empty!
              if (state.rooms.length === 0) {
                fetchRoomsList(true);
              }
            });
          }, 300);
        };
      }
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
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80" title="Serving from in-memory zero-trust cache">
        <span class="w-2 h-2 rounded-full bg-emerald-1000"></span>
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
    const url = `/api/rooms/${encodeURIComponent(state.currentRoom)}/history?before=${oldestSeq}&limit=200`;
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
// PROTOCOL HEALTH PILL
// ==========================================

export function updateProtocolPill() {
  const health = state.protocolHealth;
  if (!health || !el.protocolPill) return;

  const failCount = health.probes.filter(p => p.status === 'fail').length;
  const isOk = failCount === 0;
  const isDegraded = failCount > 0;

  // Update dot color
  if (el.protocolPillDot) {
    el.protocolPillDot.className = `w-2 h-2 rounded-full ${
      isOk ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-slate-400'
    }`;
  }

  // Update label
  if (el.protocolPillStatus) {
    el.protocolPillStatus.textContent = isOk ? 'Protocol OK' : `Protocol Degraded`;
  }

  // Update pill color
  el.protocolPill.className = el.protocolPill.className
    .replace(/text-\w+-\d+/g, '')
    .replace(/border-\w+-\d+/g, '');

  if (isOk) {
    el.protocolPill.classList.add('text-emerald-700', 'dark:text-emerald-400', 'border-emerald-200', 'dark:border-emerald-800/60');
    el.protocolPill.classList.remove('text-amber-700', 'dark:text-amber-400', 'border-amber-200', 'dark:border-amber-800/60');
  } else {
    el.protocolPill.classList.add('text-amber-700', 'dark:text-amber-400', 'border-amber-200', 'dark:border-amber-800/60');
    el.protocolPill.classList.remove('text-emerald-700', 'dark:text-emerald-400', 'border-emerald-200', 'dark:border-emerald-800/60');
  }

  // Make visible (hidden until first probe run)
  el.protocolPill.classList.remove('hidden');
}

export function openProtocolHealthModal() {
  const health = state.protocolHealth;
  if (!el.modalOverlay || !el.modalContainer) return;

  const probeRows = health
    ? health.probes.map(probe => {
        const icon = probe.status === 'pass'
          ? `<svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`
          : probe.status === 'fail'
          ? `<svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`
          : `<svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01"/></svg>`;

        const statusColor = probe.status === 'pass'
          ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
          : probe.status === 'fail'
          ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
          : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800';

        return `
          <div class="p-3 rounded-xl border ${statusColor} space-y-1">
            <div class="flex items-center gap-2">
              ${icon}
              <span class="font-mono font-bold text-xs tracking-wide uppercase">${probe.name}</span>
              <span class="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${probe.status === 'pass' ? 'bg-emerald-100 dark:bg-emerald-900/40' : probe.status === 'fail' ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-slate-200 dark:bg-slate-800'}">${probe.status}</span>
            </div>
            <p class="text-xs leading-relaxed pl-6 text-slate-600 dark:text-slate-400 font-sans">${probe.detail || ''}</p>
          </div>`;
      }).join('')
    : `<p class="text-slate-400 text-sm text-center py-6">No probe results yet. Results appear after the first successful poll.</p>`;

  const overallStatus = health?.status || 'unknown';
  const overallColor = overallStatus === 'ok'
    ? 'text-emerald-600 dark:text-emerald-400'
    : overallStatus === 'degraded'
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-slate-500';

  const lastRunText = health?.lastRun
    ? `Last run ${Math.round((Date.now() - health.lastRun) / 1000)}s ago`
    : 'Not yet run';

  el.modalContainer.innerHTML = `
    <div class="p-5 sm:p-6 space-y-5 text-slate-800 dark:text-slate-200">

      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 ${overallColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <h3 class="text-base font-bold text-slate-900 dark:text-white tracking-tight">Protocol Health Monitor</h3>
        </div>
        <button id="modal-close-btn" class="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 transition-colors rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">${lastRunText}</p>
          <p class="text-lg font-bold font-mono ${overallColor} mt-0.5">Overall: ${overallStatus.toUpperCase()}</p>
        </div>
        <button id="run-probes-btn" class="px-4 py-2 bg-[#00c2ff] hover:bg-[#009bcf] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Run Now
        </button>
      </div>

      <div class="space-y-2.5">
        <h4 class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Probe Results</h4>
        ${probeRows}
      </div>

      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-sans text-center pt-2">
        Probes are read-only and diagnostic — never accusatory. Failures are signals, not verdicts.
      </p>
    </div>
  `;

  el.modalOverlay.classList.remove('hidden');
  el.modalOverlay.classList.add('flex');

  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) closeBtn.onclick = () => { import('./ui.js').then(m => m.closeModal()); };

  const runBtn = document.getElementById('run-probes-btn');
  if (runBtn) {
    runBtn.onclick = () => {
      runBtn.disabled = true;
      runBtn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Running...`;
      
      setTimeout(() => {
        state.protocolHealth = runProbes({
          messages: state.messages,
          room: state.currentRoom,
          newMessagesSinceLastPoll: state.lastPollMessageCount,
        });
        updateProtocolPill();
        openProtocolHealthModal(); // re-render with fresh results
      }, 150);
    };
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
  const metrics = computeRoomHealth(state.currentRoom, state.messages);
  analyzeDids(state.currentRoom, state.messages);
  state.roomMetrics[state.currentRoom] = metrics;
  
  // Save snapshot and draw sparkline
  saveRoomSnapshot(metrics);
  const snapshots = getRoomSnapshots(state.currentRoom);
  
  const healthPill = document.getElementById("health-pill-trigger");
  const healthText = document.getElementById("health-pill-text");
  
  let label = "Analyzing...";
  let colorClass = "text-slate-600 dark:text-slate-400";
  let sparklineColor = "text-slate-400";
  
  if (metrics.sampleSize >= 10) {
    if (metrics.healthScore >= 80) {
      label = "Excellent";
      colorClass = "text-emerald-700 dark:text-emerald-300";
      sparklineColor = "text-emerald-500";
    } else if (metrics.healthScore >= 50) {
      label = "Moderate";
      colorClass = "text-amber-700 dark:text-amber-300";
      sparklineColor = "text-amber-500";
    } else {
      label = "Poor";
      colorClass = "text-rose-700 dark:text-rose-300";
      sparklineColor = "text-rose-500";
    }
  }

  // Update Header Pill
  if (healthPill && healthText) {
    healthPill.classList.remove("hidden", "bg-emerald-100", "border-emerald-300", "text-emerald-800", "dark:bg-emerald-950/80", "dark:border-emerald-800/80", "dark:text-emerald-400", "bg-amber-100", "border-amber-300", "text-amber-800", "dark:bg-amber-950/80", "dark:border-amber-800/80", "dark:text-amber-400", "bg-rose-100", "border-rose-300", "text-rose-800", "dark:bg-rose-950/80", "dark:border-rose-800/80", "dark:text-rose-400", "bg-slate-100", "border-slate-200", "text-slate-600", "dark:bg-slate-800", "dark:border-slate-700", "dark:text-slate-400", "shadow-emerald-500/10", "shadow-amber-500/10", "shadow-rose-500/10");
    healthPill.classList.add("flex");
    
    if (metrics.sampleSize < 10) {
      healthPill.classList.add("bg-slate-100", "border-slate-200", "text-slate-600", "dark:bg-slate-800", "dark:border-slate-700", "dark:text-slate-400");
      healthText.textContent = "Analyzing...";
    } else {
      if (metrics.healthScore >= 80) healthPill.classList.add("bg-emerald-100", "border-emerald-300", "text-emerald-800", "dark:bg-emerald-950/80", "dark:border-emerald-800/80", "dark:text-emerald-400", "shadow-emerald-500/10");
      else if (metrics.healthScore >= 50) healthPill.classList.add("bg-amber-100", "border-amber-300", "text-amber-800", "dark:bg-amber-950/80", "dark:border-amber-800/80", "dark:text-amber-400", "shadow-amber-500/10");
      else healthPill.classList.add("bg-rose-100", "border-rose-300", "text-rose-800", "dark:bg-rose-950/80", "dark:border-rose-800/80", "dark:text-rose-400", "shadow-rose-500/10");
      
      healthText.textContent = `${metrics.healthScore}% Signal · ${label}`;
    }
  }
  
  // Update Health Metric Card
  if (healthPill) {
    healthPill.onclick = () => openHealthTransparencyModal();
  }
  
  if (el.statHealth) {
    el.statHealth.className = `text-xl sm:text-2xl font-bold font-mono mt-1 z-10 transition-colors ${colorClass}`;
    el.statHealth.textContent = metrics.sampleSize < 10 ? '--' : `${metrics.healthScore}%`;
  }
  
  if (el.healthSparkline) {
    el.healthSparkline.innerHTML = generateSparklineSvg(snapshots, 60, 24, sparklineColor);
  }

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
      const fullFrom = (m.from || '').toLowerCase();
      const truncFrom = (m.from && m.from.startsWith('did:key:')) ? truncateDid(m.from).toLowerCase() : fullFrom;
      const matchFrom = fullFrom.includes(query) || truncFrom.includes(query);
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

  // 3. Usefulness filter (pure pass — URL / code / high-signal / protocol)
  filtered = applyUsefulnessFilter(filtered, state.usefulnessFilter);

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
        <button id="clear-did-filter-btn" class="flex-shrink-0 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors font-bold tracking-tight">Clear</button>
      </div>
    `;
  }

  if (el.filterCount) {
    el.filterCount.innerText = `Showing ${filtered.length} of ${state.messages.length}`;
  }

  if (el.exportBtn) {
    el.exportBtn.onclick = () => {
      exportDataAsJson(filtered, `flopscope_${state.currentRoom}_export.json`);
    };
  }

  if (filtered.length === 0) {
    html += `
      <div class="text-center py-16 px-4 rounded-2xl glass-panel text-slate-400 font-mono text-sm space-y-2">
        <svg class="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="font-bold text-slate-600 dark:text-slate-300">No messages match your criteria</p>
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
      <div class="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-slate-600 dark:text-slate-300 text-xs shadow-sm flex-shrink-0">
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
                  : `<span class="font-mono text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate">${senderDisplay}</span>`
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
      <div class="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap text-xs font-mono text-slate-500 dark:text-slate-400">
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
export function jumpToMessage(room, seq) {
  closeAgentDrawer();

  if (state.currentRoom !== room) {
    showToast(`Jumping to /r/${room}...`);
    switchRoom(room);
    // Poll every 100ms until the message card is rendered
    let attempts = 0;
    const checkExist = setInterval(() => {
      const targetEl = document.getElementById(`msg-${seq}`);
      if (targetEl || attempts > 20) {
        clearInterval(checkExist);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.classList.add('ring-2', 'ring-cyan-400');
          setTimeout(() => targetEl.classList.remove('ring-2', 'ring-cyan-400'), 2000);
        } else {
          showToast(`Message #${seq} is too old to be in the recent feed.`);
        }
      }
      attempts++;
    }, 100);
  } else {
    const targetEl = document.getElementById(`msg-${seq}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetEl.classList.add('ring-2', 'ring-cyan-400');
      setTimeout(() => targetEl.classList.remove('ring-2', 'ring-cyan-400'), 2000);
    } else {
      showToast(`Message #${seq} is too old to be in the recent feed. Load more history first.`);
    }
  }
}


export function openHealthTransparencyModal() {
  const metrics = state.roomMetrics[state.currentRoom];
  if (!metrics) return;

  const overallStatus = metrics.sampleSize < 10 ? 'ANALYZING' : (metrics.healthScore >= 80 ? 'EXCELLENT' : (metrics.healthScore >= 50 ? 'MODERATE' : 'POOR'));
  
  const overallColor = overallStatus === 'EXCELLENT'
    ? 'text-emerald-600 dark:text-emerald-400'
    : overallStatus === 'MODERATE'
    ? 'text-amber-600 dark:text-amber-400'
    : overallStatus === 'POOR'
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-slate-500';

  const lastRunText = metrics.lastComputed
    ? `Computed ${Math.round((Date.now() - metrics.lastComputed) / 1000)}s ago`
    : 'Not yet run';

  const formatRow = (name, statusText, statusType, detail) => {
    const icon = statusType === 'pass'
      ? `<svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`
      : statusType === 'fail'
      ? `<svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`
      : `<svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01"/></svg>`;

    const statusColor = statusType === 'pass'
      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
      : statusType === 'fail'
      ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
      : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800';

    const pillClass = statusType === 'pass' 
      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400' 
      : statusType === 'fail' 
      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400' 
      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

    return `
      <div class="p-3 rounded-xl border ${statusColor} space-y-1">
        <div class="flex items-center gap-2">
          ${icon}
          <span class="font-mono font-bold text-xs tracking-wide uppercase">${name}</span>
          <span class="ml-auto text-xs font-bold font-mono px-2 py-0.5 rounded-full ${pillClass}">${statusText}</span>
        </div>
        <p class="text-xs leading-relaxed pl-6 text-slate-600 dark:text-slate-400 font-sans">${detail}</p>
      </div>`;
  };

  const rows = [
    formatRow('Spam Penalty', `-${metrics.breakdown.spamPenalty || 0} / 35`, metrics.breakdown.spamPenalty > 15 ? 'fail' : 'pass', `${Math.round(metrics.spamShare*100)}% of messages matched known farming patterns.`),
    formatRow('Signal Bonus', `+${metrics.breakdown.signalBonus || 0} / 25`, metrics.breakdown.signalBonus >= 10 ? 'pass' : 'fail', `${Math.round(metrics.signalShare*100)}% of messages had meaningful length or external links.`),
    formatRow('Concentration', `-${metrics.breakdown.concentrationPenalty || 0} / 20`, metrics.breakdown.concentrationPenalty > 10 ? 'fail' : 'pass', `HHI is ${metrics.authorConcentration.toFixed(2)}. Higher means fewer DIDs dominate the room.`),
    formatRow('Reciprocity', `+${metrics.breakdown.reciprocityBonus || 0} / 15`, metrics.breakdown.reciprocityBonus > 0 ? 'pass' : 'fail', `${Math.round(metrics.reciprocity*100)}% of messages were replied to by others.`),
    formatRow('Persistence', `+${metrics.breakdown.persistenceBonus || 0} / 5`, metrics.breakdown.persistenceBonus > 0 ? 'pass' : 'fail', `${metrics.uniquePersistentDids} DIDs sent multiple messages in this window.`)
  ].join('');

  el.modalContainer.innerHTML = `
    <div class="p-5 sm:p-6 space-y-5 text-slate-800 dark:text-slate-200">

      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 ${overallColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 class="text-base font-bold text-slate-900 dark:text-white tracking-tight">Room Health Diagnostic</h3>
        </div>
        <button id="modal-close-btn" class="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 transition-colors rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">${lastRunText} (Sample size: ${metrics.sampleSize})</p>
          <p class="text-lg font-bold font-mono ${overallColor} mt-0.5">Score: ${metrics.healthScore}% · ${overallStatus}</p>
        </div>
      </div>

      <div class="space-y-2.5">
        <h4 class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Formula Breakdown</h4>
        ${rows}
      </div>

      <p class="text-[10px] text-slate-400 dark:text-slate-500 font-sans text-center pt-2">
        The Health Score is a read-only, client-side diagnostic signal, not a moral judgment.
      </p>
    </div>
  `;

  el.modalOverlay.classList.remove('hidden');
  el.modalOverlay.classList.add('flex');

  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) closeBtn.onclick = () => { import('./ui.js').then(m => m.closeModal()); };
}
