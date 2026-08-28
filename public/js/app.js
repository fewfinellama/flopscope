/**
 * Flopscope — Technocore Room Explorer & DID Verifier
 * Main Client Application Controller (ES Module)
 */

import { state, el, initElements } from './store.js';
import { showToast } from './toast.js';
import { openHealthModal } from './health-modal.js';
import { initTheme, toggleTheme } from './theme.js';
import { 
  getRoomFromUrl, 
  switchRoom, 
  loadRoomMessages, 
  fetchRoomsList, 
  loadOlderHistory, 
  renderMessagesFeed, 
  renderRoomsList,
  updateRoomHeaderInfo
} from './api.js';
import { 
  openCryptoStudio, 
  closeCryptoStudio,
  openAgentDrawer, 
  closeAgentDrawer,
  openProofInspector, 
  closeModal,
  openCommandPalette, 
  closeCommandPalette,
  renderCommandPaletteResults,
  openRawJsonModal,
  openMobileRoomsSheet,
  closeMobileRoomsSheet,
  openMobileMoreSheet,
  closeMobileMoreSheet
} from './ui.js';

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

  // Listen for custom DID filter updates
  window.addEventListener('did-filter-updated', () => {
    renderMessagesFeed();
  });

  // Room Type Filter Buttons
  document.querySelectorAll('.room-filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const filter = e.target.dataset.roomFilter;
      state.roomTypeFilter = filter;
      
      // Update UI active state
      document.querySelectorAll('.room-filter-btn').forEach((b) => {
        b.classList.remove('active', 'bg-cyan-100', 'dark:bg-cyan-950/80', 'text-cyan-800', 'dark:text-[#00c2ff]', 'border-cyan-300', 'dark:border-cyan-800/80', 'font-bold');
        b.classList.add('bg-slate-100', 'dark:bg-slate-900', 'text-slate-500', 'dark:text-slate-400', 'border-slate-200', 'dark:border-slate-800', 'font-semibold');
      });
      
      e.target.classList.add('active', 'bg-cyan-100', 'dark:bg-cyan-950/80', 'text-cyan-800', 'dark:text-[#00c2ff]', 'border-cyan-300', 'dark:border-cyan-800/80', 'font-bold');
      e.target.classList.remove('bg-slate-100', 'dark:bg-slate-900', 'text-slate-500', 'dark:text-slate-400', 'border-slate-200', 'dark:border-slate-800', 'font-semibold');
      
      renderRoomsList();
    });
  });

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
  const healthBtn = document.getElementById("health-pill-trigger");
  if (healthBtn) healthBtn.addEventListener("click", openHealthModal);
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
