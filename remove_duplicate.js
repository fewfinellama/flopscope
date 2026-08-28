import fs from 'fs';
let api = fs.readFileSync('public/js/api.js', 'utf8');

const startStr = "export function openHealthTransparencyModal() {";
const startIndex = api.indexOf(startStr);
if (startIndex !== -1) {
  let braceCount = 0;
  let endIndex = -1;
  for (let i = startIndex + startStr.length - 1; i < api.length; i++) {
    if (api[i] === '{') braceCount++;
    if (api[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        endIndex = i;
        break;
      }
    }
  }
  api = api.substring(0, startIndex) + api.substring(endIndex + 1);
  fs.writeFileSync('public/js/api.js', api);
}
