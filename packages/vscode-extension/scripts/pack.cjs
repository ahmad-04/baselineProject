const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const extDir = path.resolve(__dirname, "..");
const stageDir = path.join(extDir, ".vsix-stage");
const outVsix = path.resolve(extDir, "../../baseline-guardrails-vscode.vsix");

function log(msg) {
  console.log(`[pack] ${msg}`);
}

function rimraf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}
function mkdirp(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
}
function copyFile(src, dst) {
  mkdirp(path.dirname(dst));
  fs.copyFileSync(src, dst);
}
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  mkdirp(dst);
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dst, entry);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

// 1) Stage minimal package contents
rimraf(stageDir);
mkdirp(stageDir);

// Read and slim package.json
const pkgPath = path.join(extDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const keepFields = [
  "name",
  "displayName",
  "description",
  "version",
  "publisher",
  "license",
  "repository",
  "engines",
  "categories",
  "keywords",
  "galleryBanner",
  "activationEvents",
  "main",
  "contributes",
];
const slimPkg = {};
for (const k of keepFields) if (pkg[k] != null) slimPkg[k] = pkg[k];
// Ensure main points to dist and remove dev-only fields
delete slimPkg.scripts;
delete slimPkg.devDependencies;
delete slimPkg.files;

fs.writeFileSync(
  path.join(stageDir, "package.json"),
  JSON.stringify(slimPkg, null, 2)
);

// Copy metadata files
for (const f of ["README.md", "LICENSE"]) {
  const src = path.join(extDir, f);
  if (fs.existsSync(src)) copyFile(src, path.join(stageDir, f));
}

// Copy built dist (includes core-dist)
copyDir(path.join(extDir, "dist"), path.join(stageDir, "dist"));

// 2) Run vsce from the staged folder so it cannot see monorepo parents
log(`Packaging from staged dir: ${stageDir}`);
const result = spawnSync("npx", ["@vscode/vsce", "package", "--out", outVsix], {
  cwd: stageDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exitCode = result.status || 0;
