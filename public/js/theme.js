import { state, el } from './store.js';

export function initTheme() {
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
let _noTransitionStyle = null;

function applyTheme(theme) {
  state.theme = theme;
  try { localStorage.setItem('flopscope-theme', theme); } catch (e) {}

  // Suppress ALL transitions for this single frame so the theme swap
  // is visually instant. We inject a <style> tag, swap the class,
  // then remove the tag after two rAF ticks (giving the browser time
  // to commit the new frame before re-enabling transitions).
  if (!_noTransitionStyle) {
    _noTransitionStyle = document.createElement('style');
    _noTransitionStyle.textContent = '*,*::before,*::after{transition:none!important}';
  }
  document.head.appendChild(_noTransitionStyle);

  const root = document.documentElement;
  if (theme === 'dark') {
    if (!root.classList.replace('light', 'dark')) root.classList.add('dark');
  } else {
    if (!root.classList.replace('dark', 'light')) root.classList.add('light');
  }

  _setThemeIcons(theme);

  // Double rAF: first tick commits the DOM change, second tick removes
  // the suppressor after the browser has painted the new frame.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (_noTransitionStyle && _noTransitionStyle.parentNode) {
        document.head.removeChild(_noTransitionStyle);
      }
    });
  });
}
export function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}
export function initDensity() {
  const savedDensity = localStorage.getItem('flopscope-density');
  state.density = savedDensity || 'comfortable';
  _applyDensity(state.density);
}

export function toggleDensity() {
  const newDensity = state.density === 'comfortable' ? 'compact' : 'comfortable';
  try { localStorage.setItem('flopscope-density', newDensity); } catch (e) {}
  state.density = newDensity;
  _applyDensity(newDensity);
  
  // Dispatch a custom event so the app can re-render lists if needed
  window.dispatchEvent(new CustomEvent('density-changed'));
}

function _applyDensity(density) {
  const root = document.documentElement;
  if (density === 'compact') {
    root.classList.add('density-compact');
    if (el.densityComfortableIcon) el.densityComfortableIcon.classList.add('hidden');
    if (el.densityCompactIcon) el.densityCompactIcon.classList.remove('hidden');
    if (el.mobileDensityComfortableIcon) el.mobileDensityComfortableIcon.classList.add('hidden');
    if (el.mobileDensityCompactIcon) el.mobileDensityCompactIcon.classList.remove('hidden');
  } else {
    root.classList.remove('density-compact');
    if (el.densityComfortableIcon) el.densityComfortableIcon.classList.remove('hidden');
    if (el.densityCompactIcon) el.densityCompactIcon.classList.add('hidden');
    if (el.mobileDensityComfortableIcon) el.mobileDensityComfortableIcon.classList.remove('hidden');
    if (el.mobileDensityCompactIcon) el.mobileDensityCompactIcon.classList.add('hidden');
  }
}
