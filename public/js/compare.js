import { computeRoomHealth } from './health-scorer.js';
import { state } from './store.js';

let modalEl, closeBtn, runBtn, inputA, inputB, resultsDiv, loadingDiv;
let resultTitleA, resultTitleB, resultHealthA, resultHealthB, resultSpamA, resultSpamB, resultHhiA, resultHhiB, resultCountA, resultCountB, winnerDiv;

export function initCompareModal() {
  modalEl = document.getElementById('compare-modal-overlay');
  closeBtn = document.getElementById('close-compare-btn');
  runBtn = document.getElementById('run-compare-btn');
  inputA = document.getElementById('compare-room-a');
  inputB = document.getElementById('compare-room-b');
  resultsDiv = document.getElementById('compare-results');
  loadingDiv = document.getElementById('compare-loading');

  resultTitleA = document.getElementById('compare-title-a');
  resultTitleB = document.getElementById('compare-title-b');
  resultHealthA = document.getElementById('compare-health-a');
  resultHealthB = document.getElementById('compare-health-b');
  resultSpamA = document.getElementById('compare-spam-a');
  resultSpamB = document.getElementById('compare-spam-b');
  resultHhiA = document.getElementById('compare-hhi-a');
  resultHhiB = document.getElementById('compare-hhi-b');
  resultCountA = document.getElementById('compare-count-a');
  resultCountB = document.getElementById('compare-count-b');
  winnerDiv = document.getElementById('compare-winner');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeCompareModal);
  }
  
  if (runBtn) {
    runBtn.addEventListener('click', runComparison);
  }

  // Bind to nav button
  const navBtn = document.getElementById('nav-compare-btn');
  if (navBtn) {
    navBtn.addEventListener('click', openCompareModal);
  }
}

export function openCompareModal() {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
  modalEl.classList.add('flex');
  
  // Auto-fill Room A with current room
  if (state.currentRoom && !inputA.value) {
    inputA.value = state.currentRoom;
  }
  
  // Auto-fill Room B with lobby if Room A is not lobby
  if (!inputB.value) {
    inputB.value = state.currentRoom === 'lobby' ? 'alerts' : 'lobby';
  }
}

export function closeCompareModal() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  modalEl.classList.remove('flex');
}

async function fetchRoomFeed(room) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(room)}`);
  if (!res.ok) throw new Error(`Failed to fetch ${room}`);
  const data = await res.json();
  return data.data || [];
}

function formatScore(score, isHhi = false) {
  if (isHhi) {
    if (score > 0.5) return `<span class="text-rose-500">${(score * 100).toFixed(1)}% (High)</span>`;
    if (score > 0.2) return `<span class="text-amber-500">${(score * 100).toFixed(1)}% (Med)</span>`;
    return `<span class="text-emerald-500">${(score * 100).toFixed(1)}% (Low)</span>`;
  }
  
  if (score >= 80) return `<span class="text-emerald-500">${score.toFixed(1)}/100</span>`;
  if (score >= 50) return `<span class="text-amber-500">${score.toFixed(1)}/100</span>`;
  return `<span class="text-rose-500">${score.toFixed(1)}/100</span>`;
}

function formatSpam(share) {
  if (share > 0.4) return `<span class="text-rose-500">${(share * 100).toFixed(1)}%</span>`;
  if (share > 0.15) return `<span class="text-amber-500">${(share * 100).toFixed(1)}%</span>`;
  return `<span class="text-emerald-500">${(share * 100).toFixed(1)}%</span>`;
}

async function runComparison() {
  const roomA = inputA.value.trim().toLowerCase();
  const roomB = inputB.value.trim().toLowerCase();

  if (!roomA || !roomB) {
    alert('Please enter two rooms to compare.');
    return;
  }

  resultsDiv.classList.add('hidden');
  loadingDiv.classList.remove('hidden');
  loadingDiv.classList.add('flex');
  runBtn.disabled = true;
  runBtn.classList.add('opacity-50');

  try {
    const [msgsA, msgsB] = await Promise.all([
      fetchRoomFeed(roomA),
      fetchRoomFeed(roomB)
    ]);

    const healthA = computeRoomHealth(msgsA);
    const healthB = computeRoomHealth(msgsB);

    resultTitleA.textContent = `/r/${roomA}`;
    resultTitleB.textContent = `/r/${roomB}`;
    
    resultHealthA.innerHTML = formatScore(healthA.healthScore);
    resultHealthB.innerHTML = formatScore(healthB.healthScore);
    
    resultSpamA.innerHTML = formatSpam(healthA.spamShare);
    resultSpamB.innerHTML = formatSpam(healthB.spamShare);
    
    resultHhiA.innerHTML = formatScore(healthA.hhi, true);
    resultHhiB.innerHTML = formatScore(healthB.hhi, true);
    
    resultCountA.textContent = `${msgsA.length} msgs`;
    resultCountB.textContent = `${msgsB.length} msgs`;

    // Determine Winner
    if (healthA.healthScore > healthB.healthScore + 5) {
      winnerDiv.textContent = `🏆 /r/${roomA} is significantly healthier`;
    } else if (healthB.healthScore > healthA.healthScore + 5) {
      winnerDiv.textContent = `🏆 /r/${roomB} is significantly healthier`;
    } else {
      winnerDiv.textContent = `⚖️ Both rooms have similar health`;
    }

    loadingDiv.classList.add('hidden');
    loadingDiv.classList.remove('flex');
    resultsDiv.classList.remove('hidden');

  } catch (err) {
    console.error(err);
    alert('Failed to run comparison. Are the room names correct?');
    loadingDiv.classList.add('hidden');
    loadingDiv.classList.remove('flex');
  } finally {
    runBtn.disabled = false;
    runBtn.classList.remove('opacity-50');
  }
}
