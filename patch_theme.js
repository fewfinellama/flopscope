import fs from 'fs';
import path from 'path';

let theme = fs.readFileSync('public/js/theme.js', 'utf8');
const searchStr = `function _applyDensity(density) {
  const root = document.documentElement;
  if (density === 'compact') {
    root.classList.add('density-compact');
  } else {
    root.classList.remove('density-compact');
  }
}`;

const replaceStr = `function _applyDensity(density) {
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
}`;

theme = theme.replace(searchStr, replaceStr);
fs.writeFileSync('public/js/theme.js', theme);
