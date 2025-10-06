# Baseline Guardrails for VS Code

Real-time detection and quick fixes for non-Baseline web platform features directly in your VS Code editor. Get instant feedback as you code with inline diagnostics, hover details, and automatic guard/fallback suggestions.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/ahmad-04.baseline-guardrails-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=ahmad-04.baseline-guardrails-vscode)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/ahmad-04.baseline-guardrails-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=ahmad-04.baseline-guardrails-vscode)

## ✨ Features

### 🔍 Real-time Diagnostics
- **Inline warnings**: See non-Baseline features highlighted directly in your code
- **Smart categorization**: "Safe to adopt", "Guarded", or "Needs guard" labels
- **Target-aware**: Automatically reads your `browserslist` configuration
- **Configurable scanning**: Scan on file changes or only on save

### 💡 Quick Fixes
- **Auto-insert guards**: Click to add feature detection code
- **Fallback snippets**: Generate backward-compatible alternatives
- **Self-contained fixes**: No external dependencies required
- **Batch fixes**: Apply all fixes in a file at once

### 📊 Rich Information
- **Hover details**: Compatibility data, documentation links, and advice
- **Status bar**: Current targets, scan totals, and mode indicator
- **Browser support**: Approximate percentage of unsupported users
- **Documentation links**: Direct access to MDN and web.dev resources

### ⚙️ Seamless Integration
- **Zero configuration**: Works out of the box with sensible defaults
- **Respects browserslist**: Uses your existing target configuration
- **Configurable thresholds**: Adjust what counts as "safe" for your project
- **Language server**: Optional high-performance mode with fallback

## 🚀 Getting Started

### Installation

1. **From VS Code Marketplace**:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search for "Baseline Guardrails"
   - Click Install

2. **From Command Line**:
   ```bash
   code --install-extension ahmad-04.baseline-guardrails-vscode
   ```

### First Use

1. Open a web project in VS Code (HTML, CSS, JavaScript, TypeScript)
2. The extension activates automatically and starts scanning
3. See diagnostics appear inline for non-Baseline features
4. Hover over highlighted code for details and quick fix options
5. Check the status bar for scan summary and current targets

## 🎯 Commands

Access these commands via the Command Palette (Ctrl+Shift+P):

| Command | Description |
|---------|-------------|
| `Baseline: Scan Workspace` | Manually trigger a full workspace scan |
| `Baseline: Toggle Scan Mode` | Switch between scan-on-change and scan-on-save |
| `Baseline: Pick Targets/Threshold` | Quick picker for browserslist targets |
| `Baseline: Fix all in file` | Apply all available quick fixes in current file |
| `Baseline: Restart LSP` | Restart language server (experimental mode) |

## ⚙️ Configuration

Configure the extension in VS Code settings (File → Preferences → Settings, search for "baseline"):

### Core Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `baseline.scanOnChange` | boolean | `true` | Scan files as you type vs only on save |
| `baseline.targets` | string[] | `null` | Override browserslist targets |
| `baseline.unsupportedThreshold` | number | `5` | % threshold where "needs-guard" becomes "safe" |
| `baseline.useLsp` | boolean | `false` | Use experimental language server |

### Example Settings

```json
{
  "baseline.scanOnChange": false,
  "baseline.targets": [">0.5%", "not dead", "not op_mini all"],
  "baseline.unsupportedThreshold": 3,
  "baseline.useLsp": true
}
```

## 🎨 Screenshots

### Inline Diagnostics
![Inline diagnostics showing non-baseline features](../../docs/images/vscode-diagnostics.png)

### Hover Information
![Rich hover details with compatibility data](../../docs/images/vscode-hover.png)

### Quick Fixes
![Quick fix suggestions with guard code](../../docs/images/vscode-quickfix.png)

### Status Bar
![Status bar showing scan results](../../docs/images/vscode-status.png)

## 📚 Configuration Files

The extension automatically detects and uses:

### `baseline.config.json`
```json
{
  "targets": ">0.5% and not dead",
  "unsupportedThreshold": 5,
  "ignore": ["**/dist/**", "**/node_modules/**"],
  "features": {
    "urlpattern": true,
    "css-has": true,
    "view-transitions": false
  }
}
```

### `package.json` browserslist
```json
{
  "browserslist": [
    "> 1%",
    "last 2 versions",
    "not dead"
  ]
}
```

## 🔧 Advanced Features

### Language Server Mode

Enable experimental high-performance mode:
```json
{
  "baseline.useLsp": true
}
```

Benefits:
- Faster scanning for large files
- Better performance with multiple files open
- Automatic fallback if language server fails

### Custom Targets

Override your project's browserslist for specific scenarios:
```json
{
  "baseline.targets": [
    "last 2 Chrome versions",
    "last 2 Firefox versions",
    "last 2 Safari versions"
  ]
}
```

### Threshold Tuning

Adjust sensitivity based on your support requirements:
```json
{
  "baseline.unsupportedThreshold": 10  // More permissive
}
```

## 🎯 Quick Fix Examples

### Feature Detection Guards

**Before:**
```javascript
// ❌ Direct usage of URLPattern
const pattern = new URLPattern({ pathname: '/users/:id' });
```

**After Quick Fix:**
```javascript
// ✅ With guard
if ('URLPattern' in window) {
  const pattern = new URLPattern({ pathname: '/users/:id' });
} else {
  // Fallback implementation
  console.warn('URLPattern not supported');
}
```

### CSS Fallbacks

**Before:**
```css
/* ❌ CSS :has() without fallback */
.card:has(.featured) {
  border: 2px solid gold;
}
```

**After Quick Fix:**
```css
/* ✅ With fallback */
.card.has-featured {
  border: 2px solid gold;
}

.card:has(.featured) {
  border: 2px solid gold;
}
```

## 🚀 Integration with CLI

This extension complements the [@whoisahmad/baseline-tools-cli](../cli) package:

- **Development**: Use the extension for real-time feedback
- **CI/CD**: Use the CLI for automated checks and reporting
- **Configuration**: Both tools share the same `baseline.config.json`

```bash
# Install CLI for CI/CD
npm install -D @whoisahmad/baseline-tools-cli

# Generate reports
npx baseline-scan . --report baseline-report.html --exit-zero
```

## 🐛 Troubleshooting

### Common Issues

**Extension not activating:**
- Ensure you have supported file types open (`.js`, `.ts`, `.css`, `.html`)
- Check the Output panel (View → Output → Baseline Guardrails)

**No diagnostics showing:**
- Verify the extension is enabled
- Check if `baseline.config.json` has features disabled
- Try running "Baseline: Scan Workspace" command

**Performance issues:**
- Disable `baseline.scanOnChange` for large files
- Enable `baseline.useLsp` for better performance
- Consider excluding large directories in `baseline.config.json`

**Language server not starting:**
- Check VS Code version compatibility (requires 1.84.0+)
- Look for error messages in Output panel
- Try "Baseline: Restart LSP" command

### Debug Information

Enable detailed logging:
1. Open VS Code settings
2. Search for "baseline"
3. Enable debug logging if available
4. Check Output panel for diagnostic information

## 🎛️ Supported File Types

The extension automatically activates for:
- **JavaScript**: `.js`, `.mjs`
- **TypeScript**: `.ts`, `.tsx`
- **CSS**: `.css`, `.scss`, `.sass`, `.less`
- **HTML**: `.html`, `.htm`
- **Vue**: `.vue` (script/style sections)
- **Svelte**: `.svelte` (script/style sections)

## 🔄 Updates & Changelog

The extension auto-updates through VS Code. Check the [changelog](./CHANGELOG.md) for latest features and fixes.

**Recent highlights:**
- ✨ Enhanced quick fix suggestions
- 🚀 Performance improvements for large files
- 🎯 Better hover information with compatibility data
- 🔧 Improved configuration handling

## 🤝 Contributing

Found a bug or have a feature request?

1. **Issues**: [GitHub Issues](https://github.com/ahmad-04/baselineProject/issues)
2. **Discussions**: [GitHub Discussions](https://github.com/ahmad-04/baselineProject/discussions)
3. **Contributing**: See our [Contributing Guide](../../README.md#contributing)

### Development Setup

```bash
# Clone and setup
git clone https://github.com/ahmad-04/baselineProject.git
cd baselineProject
npm install
npm run build

# Open in VS Code
code packages/vscode-extension

# Run extension in development mode
# Press F5 to launch Extension Development Host
```

## 📄 License

MIT - see [LICENSE](../../LICENSE) for details.

## 🔗 Related

- [CLI Tool](../cli) - Command-line scanner for CI/CD
- [Main Project](../../README.md) - Complete documentation
- [Web Features Baseline](https://web.dev/baseline/) - Learn about Baseline
- [VS Code Extension API](https://code.visualstudio.com/api) - Extension development

---

<p align="center">
  <strong>Make your web code more compatible, one feature at a time! 🌐</strong>
</p>