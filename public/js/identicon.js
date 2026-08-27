/**
 * Deterministic SVG Identicon Generator for Technocore DIDs.
 * Generates unique, high-contrast, recognizable avatar icons from did:key strings.
 */

// Simple deterministic hash for string
function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Pseudo-random number generator from seed
function createPrng(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const PALETTES = [
  ['#00c2ff', '#38bdf8', '#0096c7', '#0369a1'], // FLOP Electric Cyan
  ['#10b981', '#34d399', '#059669', '#047857'], // Emerald
  ['#8b5cf6', '#a78bfa', '#7c3aed', '#6d28d9'], // Violet
  ['#f59e0b', '#fbbf24', '#d97706', '#b45309'], // Amber
  ['#ec4899', '#f472b6', '#db2777', '#be185d'], // Rose/Pink
  ['#14b8a6', '#2dd4bf', '#0d9488', '#115e59'], // Teal
  ['#6366f1', '#818cf8', '#4f46e5', '#4338ca'], // Indigo
  ['#f97316', '#fb923c', '#ea580c', '#c2410c'], // Orange
];

/**
 * Generate an SVG Identicon string for a given DID or string identifier.
 * @param {string} input - The did:key string
 * @param {number} size - Pixel size (default: 28)
 * @returns {string} SVG HTML string
 */
export function generateIdenticonSvg(input, size = 28) {
  if (!input || typeof input !== 'string') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 5 5" class="rounded-lg shadow-sm bg-slate-800"></svg>`;
  }

  const hash = hashString(input);
  const prng = createPrng(hash);

  const paletteIndex = Math.floor(prng() * PALETTES.length);
  const palette = PALETTES[paletteIndex];
  const primaryColor = palette[0];
  const secondaryColor = palette[1];
  const accentColor = palette[2];
  const bgColor = palette[3] + '33'; // transparent background

  const gridSize = 5;
  const grid = [];

  // Generate 5x5 symmetric grid (columns 0..2 mirrored to 4..3)
  for (let y = 0; y < gridSize; y++) {
    grid[y] = [];
    for (let x = 0; x < Math.ceil(gridSize / 2); x++) {
      const randVal = prng();
      const filled = randVal > 0.45;
      const colorVal = prng();
      const color = colorVal > 0.6 ? primaryColor : colorVal > 0.3 ? secondaryColor : accentColor;
      grid[y][x] = filled ? color : null;
      grid[y][gridSize - 1 - x] = filled ? color : null;
    }
  }

  let rects = '';
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cellColor = grid[y][x];
      if (cellColor) {
        rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${cellColor}" rx="0.15" />`;
      }
    }
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${gridSize} ${gridSize}" class="rounded-lg shadow-sm border border-slate-700/50 flex-shrink-0" style="background-color: ${bgColor};">
      ${rects}
    </svg>
  `;
}
