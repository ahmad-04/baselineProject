# VS Code Extension Troubleshooting

Based on our diagnostics, there are a few potential issues with the VS Code extension:

## Findings

1. **Extension configuration**: The package.json looks correct with proper activation events for TypeScript (onLanguage:typescript).
2. **Build output**: All expected build files exist, including extension.js with proper exports.
3. **Commands**: All commands are properly registered in package.json.
4. **VSIX package**: The VSIX exists but is quite small (10KB), which is suspicious for an extension with dependencies.

## Most Likely Issue

The VSIX package was created with `--no-dependencies`, but your extension depends on `@baseline-tools/core` specified as `workspace:*`.

When VS Code installs the extension, it can't resolve the workspace dependency because it's not in the package.

## Solutions

### Option 1: Fix VSIX packaging

Rebuild the VSIX with dependencies included:

```bash
cd packages/vscode-extension
npx @vscode/vsce package --out ../../baseline-guardrails-vscode.vsix
```

### Option 2: Include core in extension

1. Update the vscode-extension package.json to bundle dependencies
2. Add core's built files directly into the extension

### Option 3: Use development mode

Rather than installing from VSIX, use the VS Code "Run Extension" launch configuration to test in development mode, which would correctly resolve workspace dependencies.

## Next Steps

1. Try rebuilding the VSIX without the --no-dependencies flag
2. Open VS Code with verbose logging: `code --verbose`
3. Check the developer tools console in VS Code (`Help -> Toggle Developer Tools`)
4. Check for extension host logs about failed dependency loading

## Testing

1. Open the test-baseline.js file in VS Code
2. Open the Command Palette and try "Baseline: Scan Workspace"
3. Check Output panel with "Extension Host" selected
