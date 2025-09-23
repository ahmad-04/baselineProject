## Using Development Mode for VS Code Extension

Since building a fully bundled extension is complex due to dependency issues, the simplest solution is to run the extension directly in development mode:

### Setup Already Done

The workspace already has a launch configuration set up in `.vscode/launch.json`:

```json
{
  "name": "Run Extension (baseline-guardrails)",
  "type": "extensionHost",
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}/packages/vscode-extension"
  ],
  "outFiles": ["${workspaceFolder}/packages/vscode-extension/dist/**/*.js"],
  "preLaunchTask": "npm: build:vscode"
}
```

### Steps to Run the Extension:

1. **We just built the core and extension:**

   ```
   npm run build:core
   npm run build:vscode
   ```

2. **Launch the extension in development mode:**
   - In VS Code, press F5 (or Run → Start Debugging)
   - Select "Run Extension (baseline-guardrails)" if prompted
   - A new VS Code window will open with the extension running

3. **Test the extension:**
   - In the new window, open your `app.ts` or any JS/TS/HTML/CSS file
   - You should see:
     - Baseline diagnostics (yellow squiggles under detected features)
     - The light bulb with quick fixes
     - Status bar with Baseline info
   - Try commands like "Baseline: Scan Workspace" and "Baseline: Fix all in file"

### Why This Works:

In development mode, VS Code runs the extension directly from your project structure where all dependencies are properly resolved through the local file system.

### Next Steps:

1. Once you confirm it works in development mode, you can:
   - Continue development using F5 to test
   - Create proper bundling when ready for distribution
   - Fix the packaging issues by inlining the core module or properly managing the dependencies
