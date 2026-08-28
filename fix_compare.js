import fs from 'fs';
let js = fs.readFileSync('public/js/compare.js', 'utf8');

js = js.replace(
  "      openCompareModal();\n    });\n  }\n\nexport function openCompareModal() {",
  "      openCompareModal();\n    });\n  }\n}\n\nexport function openCompareModal() {"
);

fs.writeFileSync('public/js/compare.js', js);
