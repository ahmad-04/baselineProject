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

# Install core dependencies first
echo "Installing core dependencies..."
cd ./temp-extension/core
npm install
npm run build  # Make sure core is built

# Update the extension's package.json to use a file dependency
echo "Updating extension package.json..."
cd ../vscode-extension
sed -i 's/"@baseline-tools\/core": "workspace:\*"/"@baseline-tools\/core": "file:..\/core"/' package.json

# Install extension dependencies
echo "Installing extension dependencies..."
npm install

# Build the extension
echo "Building extension..."
npm run build

# Create a package.json for bundling
echo "Creating bundled package.json..."
cat > bundled-package.json <<EOL
{
  "name": "baseline-guardrails-vscode",
  "displayName": "Baseline Guardrails",
  "description": "Inline diagnostics and quick fixes for non-Baseline web features.",
  "version": "0.0.2",
  "publisher": "your-publisher",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/ahmad-04/baselineProject.git"
  },
  "engines": {
    "vscode": "^1.84.0"
  },
  "categories": ["Linters", "Other"],
  "activationEvents": [
    "onStartupFinished",
    "onLanguage:javascript",
    "onLanguage:typescript",
    "onLanguage:javascriptreact",
    "onLanguage:typescriptreact",
    "onLanguage:css",
    "onLanguage:html"
  ],
  "main": "./dist/extension.js",
  "contributes": $(node -e "console.log(JSON.stringify(require('./package.json').contributes))"),
  "scripts": {
    "build": "npx tsc -p tsconfig.json",
    "clean": "rimraf dist"
  },
  "dependencies": {},
  "devDependencies": {}
}
EOL

# Copy core's dist folder into extension for bundling
echo "Bundling core with extension..."
mkdir -p ./bundled-extension
cp -r ./dist ./bundled-extension/
cp ./bundled-package.json ./bundled-extension/package.json
cp -r ../core/dist ./bundled-extension/core-dist

# Add inline loader for core
echo "Creating inline loader..."
cat > ./bundled-extension/core-loader.js <<EOL
// Inline core module loader
const path = require('path');
const coreModule = require('./core-dist/index');
module.exports = coreModule;
EOL

# Create a manual bundle for simplified packaging
echo "Creating simplified bundle..."
sed -i 's/require("@baseline-tools\/core")/require(".\/core-loader.js")/' ./bundled-extension/dist/extension.js

# Package the extension with no external dependencies
echo "Packaging extension..."
cd ./bundled-extension
npx @vscode/vsce package --no-dependencies --out ../../../baseline-guardrails-local.vsix

# Cleanup
cd ../../..
echo "Done! Your local installable extension is ready at: baseline-guardrails-local.vsix"
echo ""
echo "Installation instructions:"
echo "1. In VS Code: Extensions panel → ... menu → Install from VSIX"
echo "2. Select baseline-guardrails-local.vsix"
echo "3. Reload VS Code when prompted"
echo ""
echo "The extension should now work with all features."