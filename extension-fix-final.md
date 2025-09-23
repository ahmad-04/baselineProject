## VS Code Extension Dependency Issue Fixed

I've diagnosed why the extension isn't working in VS Code:

### The Problem

1. The extension depends on `@baseline-tools/core` as `workspace:*`
2. The VSIX is packaged with `--no-dependencies`
3. When VS Code installs it, it can't find the core dependency

### Solution 1: Modify the extension package.json

```bash
# Navigate to the extension directory
cd packages/vscode-extension

# Edit package.json to change the dependency from:
# "@baseline-tools/core": "workspace:*"
# to:
# "@baseline-tools/core": "file:../../packages/core"

# Package with dependencies bundled
npx @vscode/vsce package --out ../../baseline-guardrails-vscode-fix.vsix
```

### Solution 2: Run in Development Mode

This is the easiest solution for now:

1. Launch VS Code with this repository open
2. Press F5 (or Run → Start Debugging)
3. Choose the "Run Extension (baseline-guardrails)" launch configuration
4. A new VS Code window will open with the extension running
5. Open app.ts or other files and the extension will work properly

### Solution 3: Package @baseline-tools/core first

For a proper installable VSIX:

1. Publish @baseline-tools/core to npm (or create a tarball)
2. Update the extension dependency to point to the published version
3. Package the extension with all dependencies

### Testing the Fix

After trying Solution 2 (development mode):

1. You should see the Baseline status bar item
2. Diagnostics should appear for non-Baseline features
3. Commands like "Baseline: Fix all in file" should work

### Why This Works

In development mode, the extension can access the core package via the local file system, bypassing the packaging issue completely.
