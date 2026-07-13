// Regenerates src/version.js from package.json's version field so the app
// always displays the same version npm/build tooling sees. Runs automatically
// before `npm start`/`npm run build` (see package.json's pre* scripts) because
// CRA's ModuleScopePlugin blocks importing package.json directly from src/.
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const outPath = path.join(__dirname, '..', 'src', 'version.js');
const content = `// Auto-generated from package.json by scripts/generate-version.js — do not edit directly.
export const APP_VERSION = ${JSON.stringify(pkg.version)};
`;

fs.writeFileSync(outPath, content);
console.log(`Wrote ${outPath} (version ${pkg.version})`);
