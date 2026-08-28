
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
  
  if (runBtn) {
    runBtn.addEventListener('click', runComparison);

  // Bind to nav button
  const navBtn = document.getElementById('nav-compare-btn');
  if (navBtn) {
    navBtn.addEventListener('click', openCompareModal);

export function openCompareModal() {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
  modalEl.classList.add('flex');
  
  // Auto-fill Room A with current room
  if (state.currentRoom && !inputA.value) {
    inputA.value = state.currentRoom;
  
  // Auto-fill Room B with lobby if Room A is not lobby
  if (!inputB.value) {
    inputB.value = state.currentRoom === 'lobby' ? 'alerts' : 'lobby';

export function closeCompareModal() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  modalEl.classList.remove('flex');

async function fetchRoomFeed(room) {
  const data = await res.json();
  return data.data || [];

function formatScore(score, isHhi = false) {
  if (isHhi) {
  

function formatSpam(share) {

async function runComparison() {
  const roomA = inputA.value.trim().toLowerCase();
  const roomB = inputB.value.trim().toLowerCase();

  if (!roomA || !roomB) {
    alert('Please enter two rooms to compare.');
    return;

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

    
    resultHealthA.innerHTML = formatScore(healthA.healthScore);
    resultHealthB.innerHTML = formatScore(healthB.healthScore);
    
    resultSpamA.innerHTML = formatSpam(healthA.spamShare);
    resultSpamB.innerHTML = formatSpam(healthB.spamShare);
    
    resultHhiA.innerHTML = formatScore(healthA.hhi, true);
    resultHhiB.innerHTML = formatScore(healthB.hhi, true);
    

    // Determine Winner
    if (healthA.healthScore > healthB.healthScore + 5) {
      winnerDiv.textContent = `⚖️ Both rooms have similar health`;

    loadingDiv.classList.add('hidden');
    loadingDiv.classList.remove('flex');
    resultsDiv.classList.remove('hidden');

    console.error(err);
    alert('Failed to run comparison. Are the room names correct?');
    loadingDiv.classList.add('hidden');
    loadingDiv.classList.remove('flex');
    runBtn.disabled = false;
    runBtn.classList.remove('opacity-50');

      // Close mobile sheet if open (we'll just use a generic event or click its close button)
