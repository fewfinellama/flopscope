import fs from 'fs';
let js = fs.readFileSync('public/js/compare.js', 'utf8');

const target = `  const navBtn = document.getElementById('nav-compare-btn');
  if (navBtn) {
    navBtn.addEventListener('click', openCompareModal);
  }`;

const replacement = `  const navBtn = document.getElementById('nav-compare-btn');
  if (navBtn) {
    navBtn.addEventListener('click', openCompareModal);
  }

  const mobileNavBtn = document.getElementById('mobile-compare-btn');
  if (mobileNavBtn) {
    mobileNavBtn.addEventListener('click', () => {
      const closeSheetBtn = document.getElementById('mobile-more-close');
      if (closeSheetBtn) closeSheetBtn.click();
      openCompareModal();
    });
  }`;

js = js.replace(target, replacement);
fs.writeFileSync('public/js/compare.js', js);
