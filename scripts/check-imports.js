const fs = require('fs');
const path = require('path');

let errors = 0;

function checkFile(file) {
  try {
    const code = fs.readFileSync(file, 'utf8');
    const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?|import\()(['"])(.*?)\1\)?/g;
    let m;
    while ((m = importRegex.exec(code)) !== null) {
      const impPath = m[2];
      if (impPath.startsWith('.')) {
        const resolved = path.resolve(path.dirname(file), impPath);
        if (!fs.existsSync(resolved)) {
          console.error(`MISSING IMPORT in ${file} -> "${impPath}" (resolved as ${resolved})`);
          errors++;
        }
      }
    }
  } catch(e) {
    console.error(`Error in ${file}:`, e.message);
    errors++;
  }
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') walk(full);
    } else if (f.endsWith('.js')) {
      checkFile(full);
    }
  }
}

walk('d:/handasha/js');
walk('d:/handasha');
console.log(`Import check finished with ${errors} errors.`);
