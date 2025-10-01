// Cross-platform bundler to include the analyzer from packages/core/dist into the extension
const fs = require("fs");
const path = require("path");

function log(msg) {
  console.log(`[bundle-core] ${msg}`);
}

const extRoot = path.resolve(__dirname, "..");
const src = path.resolve(extRoot, "..", "core", "dist");
const outDir = path.resolve(extRoot, "dist");
const dest = path.join(outDir, "core-dist");

if (!fs.existsSync(src)) {
  console.error(
    `[bundle-core] Source not found: ${src}. Did you build packages/core?`
  );
  process.exit(1);
}

try {
  fs.mkdirSync(outDir, { recursive: true });
} catch {}
try {
  fs.rmSync(dest, { recursive: true, force: true });
} catch {}

// Node 16+ has fs.cpSync; fallback to manual copy if unavailable
function copyRecursive(from, to) {
  if (fs.cpSync) {
    fs.cpSync(from, to, { recursive: true });
    return;
  }
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
  } else {
    fs.copyFileSync(from, to);
  }
}

log(`Copying ${src} -> ${dest}`);
copyRecursive(src, dest);
log("Done");
