// Script to publish the VS Code extension to the marketplace
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// Constants
const extDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(extDir, "package.json");
const vsixPath = path.resolve(extDir, "../../baseline-guardrails-vscode.vsix");

// Parse command line args
const args = process.argv.slice(2);
const versionBump = args[0]; // Can be 'patch', 'minor', 'major' or undefined
const skipPublish = args.includes("--skip-publish");

function log(msg) {
  console.log(`[publish] ${msg}`);
}

function runCommand(cmd, cmdArgs, options = {}) {
  log(`Running: ${cmd} ${cmdArgs.join(" ")}`);
  const result = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    log(`Command failed with exit code ${result.status}`);
    process.exit(result.status);
  }
  return result;
}

// Main execution
async function main() {
  log("Starting VS Code extension publishing process");

  // 1. Verify that the VSIX exists
  if (!fs.existsSync(vsixPath)) {
    log("VSIX package not found. Building the extension first...");
    runCommand("npm", ["run", "vsce:package"], {
      cwd: path.resolve(extDir, "../.."),
    });
  }

  // If we have a version bump, update package.json
  if (versionBump && ["patch", "minor", "major"].includes(versionBump)) {
    log(`Incrementing version (${versionBump})...`);
    runCommand("npm", ["version", versionBump, "--no-git-tag-version"], {
      cwd: extDir,
    });

    // Read the new version from package.json
    const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    log(`New version: ${pkgJson.version}`);

    // Re-build with new version
    log("Rebuilding with new version...");
    runCommand("npm", ["run", "vsce:package"], {
      cwd: path.resolve(extDir, "../.."),
    });
  }

  // Publish to marketplace unless skipped
  if (!skipPublish) {
    log("Publishing to VS Code Marketplace...");
    runCommand("npx", ["@vscode/vsce", "publish", "--packagePath", vsixPath], {
      cwd: extDir,
    });
    log("✅ Extension published successfully!");
  } else {
    log("Publishing skipped (--skip-publish flag). VSIX package is ready.");
    log(`VSIX location: ${vsixPath}`);
  }
}

main().catch((err) => {
  console.error("Error during publish:", err);
  process.exit(1);
});
