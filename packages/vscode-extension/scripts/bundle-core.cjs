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
const nmSrc = path.resolve(extRoot, "..", "core", "node_modules");
const nmDest = path.join(dest, "node_modules");

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

// Copy runtime dependencies from core's node_modules so analyzer works when packaged without external deps
if (fs.existsSync(nmSrc)) {
  try {
    log(`Copying core runtime deps: ${nmSrc} -> ${nmDest}`);
    copyRecursive(nmSrc, nmDest);
    log("Runtime deps copied");
  } catch (e) {
    console.error("[bundle-core] Failed to copy runtime dependencies", e);
  }
} else {
  log(
    "No core node_modules found; analyzer may have missing dependencies in VSIX"
  );
}

// Ensure critical packages that may be hoisted to the repo root are included.
// We resolve them from the current process resolution graph.
const MUST_HAVE = [
  "browserslist",
  "caniuse-lite",
  "web-features",
  "@typescript-eslint/typescript-estree",
];

function packageRoot(resolvedFile) {
  let dir = path.dirname(resolvedFile);
  while (dir && dir !== path.parse(dir).root) {
    const pkgFile = path.join(dir, "package.json");
    if (fs.existsSync(pkgFile)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

for (const mod of MUST_HAVE) {
  try {
    const entry = require.resolve(mod);
    const root = packageRoot(entry);
    if (!root) continue;
    const destDir = path.join(nmDest, mod.replace(/\\/g, "/"));
    if (fs.existsSync(destDir)) continue; // already copied from local node_modules
    log(`Adding hoisted dependency '${mod}' from ${root}`);
    copyRecursive(root, destDir);
  } catch (e) {
    log(`Could not resolve optional dependency '${mod}': ${e?.message || e}`);
  }
}

log("bundle-core complete");
