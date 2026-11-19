// Web file gulo www/ folder-e copy kore (Capacitor ekhan theke app banay)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of ['index.html', 'manifest.json', 'assets', 'icons']) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
console.log('www ready');
