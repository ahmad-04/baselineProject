# Baseline Guardrails VS Code Extension

The Baseline Guardrails VS Code extension has been improved to provide better functionality:

## 1. Full Workspace Scanning

The extension now properly scans the entire workspace, not just open files:

- Use the "Baseline: Scan Workspace" command to scan all JavaScript, TypeScript, HTML, and CSS files in your workspace
- Progress is shown via a notification
- Files are scanned in the background, allowing you to continue working

## 2. Improved Fix All Command

The "Baseline: Fix All in File" command now provides better fixes:

- Adds proper feature detection and fallback code for common non-Baseline features
- Generates language-specific implementations for HTML, CSS, and JavaScript/TypeScript
- Includes complete, working examples for popular features like:
  - Web Share API
  - URL parsing
  - View Transitions
  - File System Access API
  - Dialog element
  - CSS color-mix
  - And more!

## 3. Enhanced Code Actions

When you click on the lightbulb for a specific diagnostic:

- You'll now get a more comprehensive implementation
- Includes proper feature detection with appropriate fallbacks
- Generates language-specific code for HTML, CSS, and JavaScript/TypeScript

## Usage

1. Open your web project with JavaScript, TypeScript, HTML, or CSS files
2. Run "Baseline: Scan Workspace" from the Command Palette to analyze all files
3. View the diagnostics (yellow squiggles) for non-Baseline features
4. Click the lightbulb or use "Baseline: Fix All in File" to add compatibility code

## Running in Development Mode

For best results, run the extension in development mode:

1. Press F5 (or Run → Start Debugging) in VS Code
2. Select "Run Extension (baseline-guardrails)" if prompted
3. A new VS Code window will open with the extension running

This ensures all dependencies are properly resolved.

## Note About VSIX Packaging

When packaging as VSIX, you need to ensure dependencies are included:

```bash
cd packages/vscode-extension
npx @vscode/vsce package --out ../../baseline-guardrails-vscode.vsix
```

Do not use the `--no-dependencies` flag as it will exclude required modules.
