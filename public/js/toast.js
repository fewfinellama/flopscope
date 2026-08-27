import { el } from './store.js';

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