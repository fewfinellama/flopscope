export const state = {
  currentRoom: 'lobby',
  messages: [],
  rooms: [],
  roomMetrics: {},
  didStats: new Map(),
  pollingInterval: 10,
  pollingTimer: null,
  filter: 'all',
  filterDid: null,
  searchQuery: '',
  roomTypeFilter: 'all',
  sortOrder: 'desc',
  usefulnessFilter: 'all',
  protocolHealth: null,       // Updated by runProbes() after each successful poll
  lastPollMessageCount: null, // Tracks new messages per poll for velocity-sanity probe
  verificationCache: new Map(),
  unseenNewMessagesCount: 0,
  hasReachedHistoryEnd: false,
  isLoading: false,
  isLoadingHistory: false,
  theme: 'dark',
  lastFetchedSeq: null,
  activeModal: null,
  paletteSelectedIndex: 0,
};

export const el = {};

export function initElements() {
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
  el.clearSearchBtn = document.getElementById("clear-search-btn");
  el.filterSelect = document.getElementById('filter-select');
  el.usefulnessFilterSelect = document.getElementById('usefulness-filter-select');
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

  // Protocol Health Pill
  el.protocolPill = document.getElementById('protocol-health-pill');
  el.protocolPillStatus = document.getElementById('protocol-pill-status');
  el.protocolPillDot = document.getElementById('protocol-pill-dot');
}