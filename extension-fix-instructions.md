## VS Code Extension Fix Instructions

I've found the root cause: the VSIX is packaged with `--no-dependencies` flag, which means it doesn't include the required dependencies from your workspace.

### To fix:

1. Edit the root `package.json` script:
   - Change:
     ```json
     "vsce:package": "cd packages/vscode-extension && npx @vscode/vsce package --no-dependencies --out ../../baseline-guardrails-vscode.vsix"
     ```
   - To:
     ```json
     "vsce:package": "cd packages/vscode-extension && npx @vscode/vsce package --out ../../baseline-guardrails-vscode.vsix"
     ```

2. Rebuild the VSIX:

   ```bash
   cd C:/Github_projects/baselineProject
   npm run vsce:package
   ```

3. Uninstall the current extension from VS Code

4. Reload VS Code window (Ctrl+Shift+P → "Reload Window")

5. Install the new VSIX (Extensions panel → ... menu → Install from VSIX)

6. Reload VS Code again

7. Open your TypeScript or JavaScript file and you should see:
   - Baseline status bar
   - Diagnostics for non-baseline features
   - Light bulb with quick fixes
   - Command "Baseline: Fix all in file" working

### Alternative: Run in Development Mode

If packaging still gives issues, you can run in development mode:

1. Go to Run & Debug panel (Ctrl+Shift+D)
2. Select "Run Extension" configuration (create if needed)
3. Press F5 to run the extension in a new VS Code window

This bypasses VSIX packaging entirely and loads the extension directly from source.
