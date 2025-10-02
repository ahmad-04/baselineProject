#!/bin/bash
# Helper script to publish the VS Code extension

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Display header
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}   Baseline Guardrails VS Code Publish  ${NC}"
echo -e "${YELLOW}========================================${NC}"

# Check if version is specified
VERSION_TYPE=$1
SKIP_PUBLISH=false

# Process arguments
for arg in "$@"; do
  if [ "$arg" == "--skip-publish" ]; then
    SKIP_PUBLISH=true
  fi
done

# Validate version type
if [ "$VERSION_TYPE" != "patch" ] && [ "$VERSION_TYPE" != "minor" ] && [ "$VERSION_TYPE" != "major" ] && [ -n "$VERSION_TYPE" ] && [ "$VERSION_TYPE" != "--skip-publish" ]; then
  echo -e "${RED}Error: Version type must be patch, minor, or major.${NC}"
  echo "Usage: ./publish-vscode-extension.sh [patch|minor|major] [--skip-publish]"
  exit 1
fi

# Build the extension first
echo -e "${YELLOW}Building the extension...${NC}"
npm run build

# Publish with specified version if provided
if [ -n "$VERSION_TYPE" ] && [ "$VERSION_TYPE" != "--skip-publish" ]; then
  echo -e "${YELLOW}Publishing with ${VERSION_TYPE} version increment...${NC}"
  if [ "$SKIP_PUBLISH" = true ]; then
    npm --prefix packages/vscode-extension run publish:${VERSION_TYPE} -- --skip-publish
  else
    npm --prefix packages/vscode-extension run publish:${VERSION_TYPE}
  fi
else
  echo -e "${YELLOW}Publishing with current version...${NC}"
  if [ "$SKIP_PUBLISH" = true ]; then
    npm --prefix packages/vscode-extension run publish -- --skip-publish
  else
    npm --prefix packages/vscode-extension run publish
  fi
fi

# Check if successful
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Extension publish process completed!${NC}"
  echo "- The .vsix file is available at: baseline-guardrails-vscode.vsix"
  if [ "$SKIP_PUBLISH" = false ]; then
    echo "- Published to VS Code Marketplace"
  fi
else
  echo -e "${RED}✗ Extension publish process failed!${NC}"
  exit 1
fi