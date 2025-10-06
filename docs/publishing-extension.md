# Publishing the VS Code Extension

This document outlines the process for publishing the Baseline Guardrails VS Code extension to the Visual Studio Code Marketplace.

## Prerequisites

1. **Personal Access Token (PAT)**:
   - You need a Personal Access Token for the VS Code Marketplace
   - Create one at: https://dev.azure.com/[your-organization]/_usersSettings/tokens
   - Ensure it has the "Marketplace > Manage" scope
   - Add this token as a GitHub secret named `VSCE_PAT` in your repository settings

2. **Version Management**:
   - The extension version is controlled in `packages/vscode-extension/package.json`
   - Versions must follow semver (e.g., 0.1.0, 1.0.0)

## Publishing Methods

### Method 1: Using npm Scripts (Recommended)

The project includes convenient npm scripts for packaging and publishing:

```bash
# Package the extension (creates .vsix file)
npm run vsce:package

# Publish with automatic patch version bump
npm run vsce:publish:patch

# Publish with automatic minor version bump
npm run vsce:publish:minor

# Publish with automatic major version bump
npm run vsce:publish:major

# Publish current version (no version bump)
npm run vsce:publish
```

### Method 2: Automatic Publishing via GitHub Actions

### Method 1: Automatic Publishing via GitHub Actions

#### Option A: Using Version Tags

1. Create and push a version tag that starts with "v":
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
2. This will trigger the `Publish VS Code Extension` workflow
3. The workflow will:
   - Build the extension
   - Package it as a .vsix file
   - Publish to the VS Code Marketplace
   - Create a GitHub Release with the .vsix attached

#### Option B: Manual Workflow Dispatch

1. Go to the "Actions" tab in your GitHub repository
2. Select the "Publish VS Code Extension" workflow
3. Click "Run workflow"
4. Choose a version increment type (patch, minor, major, or none)
5. Click "Run workflow"

### Method 2: Manual Publishing

If you prefer to publish manually:

1. Build and package the extension:

   ```bash
   npm run vsce:package
   ```

2. Publish using vsce:

   ```bash
   cd packages/vscode-extension
   npx @vscode/vsce publish --packagePath ../../baseline-guardrails-vscode.vsix
   ```

3. Or publish an existing .vsix:
   ```bash
   npx @vscode/vsce publish --packagePath path/to/baseline-guardrails-vscode.vsix
   ```

## Troubleshooting

- **Authentication Issues**: Ensure your PAT is valid and has the correct scope
- **Version Conflicts**: Each publish requires a new version in package.json
- **Publishing Errors**: Check the publisher name in package.json matches your Marketplace account

## Post-Publish

After publishing:

1. Verify the extension appears on the Marketplace: https://marketplace.visualstudio.com/items?itemName=ahmad-04.baseline-guardrails-vscode
2. Test installation from the Marketplace in a clean VS Code instance
3. Update documentation with the new version details if needed
