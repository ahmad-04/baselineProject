# Guard & Fallback Recipes

Practical patterns for safely adopting modern web features with progressive enhancement and fallbacks.

## 📋 Available Recipes

### JavaScript APIs
- [Web Share API](./guard-web-share.md) - Share content with native share UI
- [URL.canParse()](./guard-url-canparse.md) - URL validation before parsing
- [View Transitions API](./guard-view-transitions.md) - Smooth page transitions
- [File System Access API](./guard-file-picker.md) - Native file picker functionality

### CSS Features
- [Container Queries](./css-container-queries-fallback.md) - Element-based responsive design
- [CSS :has()](./css-has-progressive-enhancement.md) - Parent selector with fallbacks

### HTML Features
- [Popover API](./html-popover-fallback.md) - Native popup elements

## 🎯 How to Use

Each recipe includes:
- **Feature detection** - How to check if the feature is supported
- **Guard implementation** - Safe usage patterns
- **Fallback strategies** - Alternative implementations for unsupported browsers
- **Progressive enhancement** - Layer modern features on top of solid foundations

## 💡 Contributing Recipes

Have a guard pattern that works well? Consider contributing:

1. Follow the existing recipe format
2. Include working code examples
3. Test across multiple browsers
4. Document browser support clearly

## 🔗 Related

- [VS Code Extension](../../packages/vscode-extension) - Get these patterns as quick fixes
- [CLI Tool](../../packages/cli) - Detect these patterns in your codebase
- [Main Documentation](../../README.md) - Complete project overview
