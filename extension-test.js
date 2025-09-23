// This is a simple test script to verify extension activation
const fs = require("fs");
const path = require("path");

console.log("Checking extension status...");

// Check extension build files
const distPath = path.join(__dirname, "packages/vscode-extension/dist");
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath);
  console.log("Extension dist files:", files);

  // Check extension.js file
  const extJsPath = path.join(distPath, "extension.js");
  if (fs.existsSync(extJsPath)) {
    const extJsStats = fs.statSync(extJsPath);
    console.log(`extension.js size: ${extJsStats.size} bytes`);

    // Check if the file contains expected exports
    const extJs = fs.readFileSync(extJsPath, "utf8");
    const hasActivate = extJs.includes("exports.activate");
    const hasDeactivate = extJs.includes("exports.deactivate");
    console.log(`Has activate export: ${hasActivate}`);
    console.log(`Has deactivate export: ${hasDeactivate}`);
  } else {
    console.log("ERROR: extension.js not found!");
  }
} else {
  console.log("ERROR: dist directory not found!");
}

// Check package.json configuration
const packageJsonPath = path.join(
  __dirname,
  "packages/vscode-extension/package.json"
);
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  console.log("Extension version:", packageJson.version);
  console.log("Activation events:", packageJson.activationEvents);
  console.log("Main file:", packageJson.main);
  console.log(
    "Commands:",
    packageJson.contributes?.commands?.map((cmd) => cmd.command)
  );
} else {
  console.log("ERROR: package.json not found!");
}

// Check for dependencies issues
const depPath = path.join(__dirname, "node_modules/@baseline-tools/core");
if (fs.existsSync(depPath)) {
  console.log("Core dependency found");
} else {
  console.log("ERROR: Core dependency not found!");
}

console.log("\nVSIX Status:");
const vsixPath = path.join(__dirname, "baseline-guardrails-vscode.vsix");
if (fs.existsSync(vsixPath)) {
  const vsixStats = fs.statSync(vsixPath);
  console.log(`VSIX file exists: ${vsixStats.size} bytes`);
} else {
  console.log("ERROR: VSIX file not found!");
}

console.log("\nPossible issues:");
console.log(
  "1. Extension may not be properly packaged (try with --no-dependencies)"
);
console.log(
  "2. Core dependency resolution may be failing in the extension context"
);
console.log("3. VS Code might require a specific version of the extension API");
console.log("4. The extension might be disabled or blocked");
