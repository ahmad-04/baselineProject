#!/usr/bin/env bash
set -e

# Make a working directory for our temporary copy
echo "Creating working directory..."
mkdir -p ./temp-extension
rm -rf ./temp-extension/*

# Copy core and extension files
echo "Copying core and extension files..."
cp -r ./packages/core ./temp-extension/
cp -r ./packages/vscode-extension ./temp-extension/

# Update the package.json to use a file dependency
echo "Updating package.json..."
cd ./temp-extension/vscode-extension

# Replace workspace:* dependency with file:../core
sed -i 's/"@baseline-tools\/core": "workspace:\*"/"@baseline-tools\/core": "file:..\/core"/' package.json

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the extension
echo "Building extension..."
npm run build

# Package the extension with dependencies
echo "Packaging extension..."
npx @vscode/vsce package --out ../../baseline-guardrails-local.vsix

# Cleanup
cd ../..
echo "Done! Your local installable extension is ready at: baseline-guardrails-local.vsix"
echo ""
echo "Installation instructions:"
echo "1. In VS Code: Extensions panel → ... menu → Install from VSIX"
echo "2. Select baseline-guardrails-local.vsix"
echo "3. Reload VS Code when prompted"
echo ""
echo "The extension should now work with all features."