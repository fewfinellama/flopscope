import fs from 'fs';
let app = fs.readFileSync('public/js/app.js', 'utf8');

app = app.replace(
  'if (el.themeToggleBtn) el.themeToggleBtn.onclick = toggleTheme;',
  'if (el.themeToggleBtn) el.themeToggleBtn.onclick = toggleTheme;\n  if (el.mobileThemeToggleBtn) el.mobileThemeToggleBtn.onclick = toggleTheme;'
);

app = app.replace(
  'if (el.densityToggleBtn) el.densityToggleBtn.onclick = toggleDensity;',
  'if (el.densityToggleBtn) el.densityToggleBtn.onclick = toggleDensity;\n  if (el.mobileDensityToggleBtn) el.mobileDensityToggleBtn.onclick = toggleDensity;'
);

fs.writeFileSync('public/js/app.js', app);
