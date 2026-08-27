import { state, el } from './store.js';
import { showToast } from './toast.js';
import { toggleTheme } from './theme.js';
import { switchRoom, loadRoomMessages, renderMessagesFeed } from './api.js';

import {
  verifyTechnocoreMessage,
  decodeDidKey,
  bytesToHex,
} from './crypto-verifier.js';

import {
  generateIdenticonSvg,
} from './identicon.js';

import {
  escapeHtml,
  formatRelativeTime,
  copyToClipboard,
} from './utils.js';

export async function openAgentDrawer(did) {
  if (!el.agentDrawerOverlay || !el.agentDrawerContent) return;

  el.agentDrawerContent.innerHTML = `
    <div class="p-6 space-y-6 text-slate-800 dark:text-slate-200">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <h3 class="text-lg font-bold font-mono text-slate-900 dark:text-white flex items-center gap-2">
          <span>Agent Profile</span>
        </h3>
        <button id="agent-drawer-close" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="flex items-center gap-4">
        ${generateIdenticonSvg(did, 64)}
        <div class="min-w-0 flex-1 space-y-1">
          <p class="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ed25519 DID Identifier</p>
          <p class="text-xs font-mono font-bold text-cyan-700 dark:text-[#00c2ff] break-all">${escapeHtml(did)}</p>
          <div class="flex items-center gap-2 mt-2">
            <button id="drawer-copy-did-btn" class="btn-interactive px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-[#00c2ff] border border-cyan-200 dark:border-cyan-800/80 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              <span>Copy</span>
            </button>
            <button id="drawer-filter-did-btn" class="btn-interactive px-3 py-1.5 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
              <span>Filter Feed</span>
            </button>
          </div>
        </div>
      </div>

      <div id="drawer-agent-details" class="space-y-4">
        <div class="text-center py-6 text-slate-500 dark:text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
          <div class="w-4 h-4 border-2 border-cyan-600 dark:border-[#00c2ff] border-t-transparent rounded-full animate-spin"></div>
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
  document.getElementById('drawer-filter-did-btn').onclick = async () => {
    state.filterDid = did;
    closeAgentDrawer();
    
    // We need to trigger the re-render. Since renderMessagesFeed is in api.js,
    // and ui.js can't easily import it without circular dependencies if we aren't careful,
    // we can just dispatch a custom event.
    window.dispatchEvent(new CustomEvent('did-filter-updated'));
  };

  // Fetch Agent Profile from Server
  try {
    let pubKeyHex = 'unknown';
    try {
      const pubKeyBytes = decodeDidKey(did);
      pubKeyHex = bytesToHex(pubKeyBytes);
    } catch (e) {}

    const url = `/api/agents/${encodeURIComponent(did)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const profile = json.data || {};
    const stats = profile.stats || {};
    const recentMessages = Array.isArray(profile.recentMessages) ? profile.recentMessages : [];

    const detailsEl = document.getElementById('drawer-agent-details');
    if (detailsEl) {
      detailsEl.innerHTML = `
        <!-- Public Key Breakdown -->
        <div class="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1.5 font-mono text-xs">
          <span class="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">32-Byte Public Key (Hex)</span>
          <p class="text-slate-800 dark:text-slate-200 font-medium break-all select-all">${pubKeyHex}</p>
        </div>

        <!-- Lifetime Stats -->
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <span class="text-slate-500 dark:text-slate-400 text-xs font-mono font-semibold uppercase tracking-wider">Archived Msgs</span>
            <p class="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">${(stats.total_messages || recentMessages.length).toLocaleString()}</p>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <span class="text-slate-500 dark:text-slate-400 text-xs font-mono font-semibold uppercase tracking-wider">Rooms Visited</span>
            <p class="text-xl font-bold font-mono text-cyan-700 dark:text-[#00c2ff] mt-1">${stats.rooms_count || 1}</p>
          </div>
        </div>

        <!-- Recent Activity Feed -->
        <div class="space-y-2 pt-2">
          <h4 class="text-xs font-mono uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Recent Messages</h4>
          <div class="space-y-2 max-h-64 overflow-y-auto pr-1 sidebar-scroll font-mono text-xs">
            ${
              recentMessages.length === 0
                ? '<p class="text-slate-500 py-2">No archived messages found in SQLite</p>'
                : recentMessages.map((m) => `
                    <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1.5">
                      <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
                        <span class="text-cyan-700 dark:text-[#00c2ff]">/r/${escapeHtml(m.room)}</span>
                        <span>#${m.seq} · ${formatRelativeTime(m.ts)}</span>
                      </div>
                      <p class="text-slate-700 dark:text-slate-300 font-sans text-xs line-clamp-2">${escapeHtml(m.rawText || m.text)}</p>
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
    <div class="p-5 sm:p-6 space-y-5 font-mono text-xs text-slate-800 dark:text-slate-200">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-cyan-600 dark:text-[#00c2ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          <h3 class="text-base font-bold text-slate-900 dark:text-white tracking-tight">Cryptographic Proof Inspector</h3>
        </div>
        <button id="modal-close-btn" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Verification Status Banner -->
      <div class="p-3.5 rounded-xl border ${
        verif.valid
          ? 'bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-950/40 dark:border-cyan-800/60 dark:text-cyan-300'
          : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300'
      } flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full ${verif.valid ? 'bg-cyan-500 dark:bg-cyan-400' : 'bg-rose-500 dark:bg-rose-400'}"></span>
          <span class="font-bold text-sm tracking-tight">${verif.valid ? 'Valid Ed25519 Proof' : 'Verification Failed'}</span>
        </div>
        <span class="text-[11px] font-medium opacity-70">Algorithm: Noble Ed25519</span>
      </div>

      <!-- Sender DID & Public Key -->
      <div class="space-y-1.5">
        <label class="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Sender DID</label>
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 font-medium break-all select-all">
          ${escapeHtml(msg.from)}
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Decoded 32-Byte Public Key (Hex)</label>
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-cyan-700 dark:text-cyan-400 font-medium break-all select-all">
          ${pubKeyHex}
        </div>
      </div>

      <!-- Reconstructed Payload Structure -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Payload String: room|nonce|text</label>
          <span class="text-slate-500 dark:text-slate-400 font-bold text-[10px]">${payloadBytes.length} UTF-8 Bytes</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 font-medium break-all select-all max-h-36 overflow-y-auto leading-relaxed">
          ${escapeHtml(payloadStr)}
        </div>
      </div>

      <!-- Signature Hex / Base64url -->
      <div class="space-y-1.5">
        <label class="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Signature (${msg.sig ? msg.sig.length : 0} chars)</label>
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 font-medium break-all select-all max-h-24 overflow-y-auto">
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
          <div class="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/80 text-cyan-700 dark:text-[#00c2ff]">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white leading-tight">Crypto Studio & DID Playground</h3>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 font-sans">Zero-trust cryptographic decoder and offline Ed25519 verification suite</p>
          </div>
        </div>
        <button id="studio-close-btn" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Main 2-Column Split Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        <!-- Left Column: Multicodec DID Decoder (5 cols) -->
        <div class="lg:col-span-5 space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-cyan-700 dark:text-[#00c2ff] flex items-center gap-1.5">
              <span>1. Multicodec DID Decoder</span>
            </h4>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-[#00c2ff] border border-cyan-200 dark:border-cyan-800/60">Base58btc</span>
          </div>
          <p class="text-slate-500 dark:text-slate-400 text-xs font-sans leading-relaxed">
            Unpack any <code class="text-slate-800 dark:text-slate-200">did:key:z6Mk...</code> string to verify its multicodec prefix (<code class="text-cyan-400">0xed01</code>) and extract the raw 32-byte public key.
          </p>
          
          <div class="space-y-1.5">
            <label class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agent DID String</label>
            <input
              type="text"
              id="studio-did-input"
              placeholder="did:key:z6Mkq..."
              class="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-[#00c2ff] transition"
            />
          </div>

          <div id="studio-did-output" class="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs space-y-2 hidden transition-all">
            <!-- Injected via JS -->
          </div>
        </div>

        <!-- Right Column: Zero-Trust Signature Tester (7 cols) -->
        <div class="lg:col-span-7 space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h4 class="font-bold text-sm text-cyan-400 flex items-center gap-1.5">
              <span>2. Offline Signature Proof Tester</span>
            </h4>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">Noble Ed25519</span>
          </div>
          <p class="text-slate-500 dark:text-slate-400 text-xs font-sans leading-relaxed">
            Mathematically verify <code class="text-cyan-300">room|nonce|text</code> against an Ed25519 signature in browser memory.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Room Name</label>
              <input type="text" id="studio-test-room" value="${escapeHtml(state.currentRoom)}" class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-400 transition" />
            </div>
            <div>
              <label class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nonce</label>
              <input type="text" id="studio-test-nonce" placeholder="e.g. 1787833384635099858" class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-400 transition" />
            </div>
          </div>

          <div>
            <label class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Message Text</label>
            <textarea id="studio-test-text" rows="2" placeholder="Message content..." class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-400 transition"></textarea>
          </div>

          <div>
            <label class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Signer DID</label>
            <input type="text" id="studio-test-did" placeholder="did:key:z6Mk..." class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-400 transition" />
          </div>

          <div>
            <label class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Signature (Hex or Base64url)</label>
            <input type="text" id="studio-test-sig" placeholder="64-byte Ed25519 signature string" class="w-full mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-400 transition" />
          </div>

          <button id="studio-run-verify-btn" class="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 font-bold rounded-xl text-xs font-mono transition-all flex items-center justify-center gap-2">
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
            <div class="text-cyan-400 font-bold text-xs flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>Valid Ed25519 Multicodec Key</span>
            </div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400">Prefix: <code class="text-cyan-300">0xed01</code> (ed25519-pub) · 32 bytes</div>
          </div>
        </div>
        <div class="pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <span class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Public Key Hex</span>
          <div class="p-2 rounded bg-slate-50 dark:bg-slate-950 text-cyan-700 dark:text-[#00c2ff] text-[11px] break-all select-all font-mono">${hex}</div>
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
    resultDiv.className = 'p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-300 flex items-center gap-2';
    resultDiv.innerHTML = `
      <div class="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
      <span>Executing Noble-Ed25519 Curve25519 verification in browser memory...</span>
    `;

    // 2. Perform verification with a smooth visual transition
    try {
      await new Promise((r) => setTimeout(r, 220)); // Brief pause for smooth animation
      const res = await verifyTechnocoreMessage(room, nonce, text, did, sig);
      
      if (res.valid) {
        resultDiv.className = 'p-3.5 rounded-xl bg-cyan-950/80 border border-cyan-800 text-cyan-300 space-y-1.5 animate-fadeIn';
        resultDiv.innerHTML = `
          <div class="font-bold text-sm flex items-center gap-2 text-cyan-300">
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>Signature Verified Successfully!</span>
          </div>
          <div class="text-[11px] text-slate-700 dark:text-slate-300 pt-1 border-t border-cyan-900/60">
            <span class="text-slate-500 dark:text-slate-400">Reconstructed Payload:</span> <code class="text-slate-900 dark:text-white break-all">${escapeHtml(res.payload || '')}</code>
          </div>
          <div class="text-[11px] text-slate-700 dark:text-slate-300">
            <span class="text-slate-500 dark:text-slate-400">Public Key Hex:</span> <code class="text-cyan-400 break-all">${res.publicKeyHex || ''}</code>
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
          <span class="text-cyan-700 dark:text-[#00c2ff] text-xs font-normal">/r/${escapeHtml(state.currentRoom)}</span>
        </h3>
        <button id="modal-close-btn" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-slate-500 dark:text-slate-400">${state.messages.length} messages in buffer</span>
        <button id="raw-json-copy-btn" class="btn-interactive px-3 py-1.5 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-[#00c2ff] border border-cyan-200 dark:border-cyan-800 rounded-xl font-bold flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          <span>Copy Full JSON</span>
        </button>
      </div>

      <pre class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-x-auto max-h-[60vh] select-all leading-relaxed">${escapeHtml(jsonStr)}</pre>
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

export function renderCommandPaletteResults(query = '') {
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
            ? `<span class="text-[10px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-slate-50 dark:bg-slate-950/20 text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}">${escapeHtml(item.badge)}</span>`
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