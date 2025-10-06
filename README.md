# Baseline Guardrails

<p align="left">
  <a href="https://www.npmjs.com/package/@whoisahmad/baseline-tools-cli"><img alt="CLI version" src="https://img.shields.io/npm/v/%40whoisahmad%2fbaseline-tools-cli.svg?label=baseline-cli" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=ahmad-04.baseline-guardrails-vscode"><img alt="VS Code Extension" src="https://img.shields.io/visual-studio-marketplace/v/ahmad-04.baseline-guardrails-vscode.svg?label=vscode-extension" /></a>
</p>

Detect and guard against non-Baseline web platform features in your codebase. Available as both a **CLI tool** for CI/CD pipelines and a **VS Code extension** for real-time development feedback.

[![Tests](https://github.com/ahmad-04/baselineProject/actions/workflows/tests.yml/badge.svg)](https://github.com/ahmad-04/baselineProject/actions/workflows/tests.yml)

## 📦 Packages

- **[@whoisahmad/baseline-tools-cli](./packages/cli)**: Command-line scanner with JSON, HTML, and SARIF reporting
- **[Baseline Guardrails VS Code Extension](./packages/vscode-extension)**: Inline diagnostics and quick fixes in your editor

## ✨ Features

### CLI Tool
- 🎯 **Target-aware scanning**: Reads `browserslist` and shows "about X% may lack support"
- 📊 **Multiple output formats**: Console, JSON, HTML reports, and SARIF for GitHub Code Scanning
- 🛡️ **Guard detection**: Recognizes capability guards to downgrade severity
- ⚡ **Incremental scanning**: `--changed` flag for PR workflows
- 🎛️ **Configurable**: `baseline.config.json` for targets, thresholds, and feature toggles

### VS Code Extension
- 🔍 **Real-time diagnostics**: Inline warnings and errors as you type
- 💡 **Quick fixes**: Auto-insert guard/fallback code snippets
- 📈 **Status bar**: Shows scan totals and current targets
- ⚙️ **Configurable scan modes**: On change or on save
- 🎨 **Hover details**: Rich information with docs links and compatibility data

## 🏗️ Architecture

This monorepo contains:
- **`packages/core`**: Internal analyzer engine (not published)
- **`packages/cli`**: Published CLI tool
- **`packages/vscode-extension`**: VS Code extension
- **`packages/helpers`**: Internal utilities
- **`packages/lsp-server`**: Language server for the extension
- **`examples/demo-repo`**: Test cases and examples

## 🚀 Quick Start

### CLI Tool

Install as dev dependency or run directly:

```bash
# Install locally
npm install -D @whoisahmad/baseline-tools-cli

# Or run directly
npx @whoisahmad/baseline-tools-cli ./src --report baseline-report.html --exit-zero
```

### VS Code Extension

1. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ahmad-04.baseline-guardrails-vscode)
2. Open a web project in VS Code
3. The extension will automatically start scanning your files
4. See diagnostics inline and use quick fixes for common patterns

### Development Setup

For contributing to this project:

```bash
# Clone and install
git clone https://github.com/ahmad-04/baselineProject.git
cd baselineProject
npm install
npm run build

# Test CLI locally
node packages/cli/dist/index.js examples/demo-repo --report baseline-report.html --exit-zero

# Package VS Code extension
npm run vsce:package
```

## 🛠️ CLI Usage

```bash
baseline-scan <path> [--json] [--report <file>] [--exit-zero] [--files <csv>] [--unsupported-threshold <n>] [--config <path>]
```

Key options:
- `--json`: Print JSON report to stdout
- `--report <file>`: Write JSON (`.json`), HTML (`.html`), or SARIF (`.sarif`) report
- `--exit-zero`: Never fail the process (useful for CI summaries)
- `--files <csv>`: Only scan specific files/globs (for PR diffs)
- `--unsupported-threshold <n>`: Treat "needs-guard" as "safe" when unsupported% ≤ n
- `--config <path>`: Custom `baseline.config.json` path
- `--changed`: Scan only files changed vs `HEAD` (includes untracked)
- `--since <ref>`: Use different base ref for `--changed` (e.g., `origin/main`)
- `--cache`: Enable content-hash cache for faster subsequent runs

### Examples

Basic scan with HTML report:

```bash
npx @whoisahmad/baseline-tools-cli ./src --report baseline-report.html --exit-zero
```

JSON and SARIF reports:

```bash
# JSON report
npx @whoisahmad/baseline-tools-cli ./src --json --report baseline-report.json --exit-zero

# SARIF for GitHub Code Scanning
npx @whoisahmad/baseline-tools-cli ./src --report baseline-report.sarif --exit-zero
```

Changed files only (for PR workflows):

```bash
npx @whoisahmad/baseline-tools-cli . --changed --since origin/main --exit-zero
```

## 🎨 VS Code Extension Features

The VS Code extension provides real-time feedback while you code:

### Commands
- **Baseline: Scan Workspace** - Manually trigger a full workspace scan
- **Baseline: Toggle Scan Mode** - Switch between scan-on-change and scan-on-save
- **Baseline: Pick Targets/Threshold** - Quickly adjust browserslist targets
- **Baseline: Fix all in file** - Apply all available quick fixes

### Settings
Configure the extension in VS Code settings:
- `baseline.scanOnChange`: Scan on file changes vs only on save
- `baseline.targets`: Override browserslist targets
- `baseline.unsupportedThreshold`: Percentage threshold for "safe" classification
- `baseline.useLsp`: Use experimental language server (with fallback)

## 📊 Output Formats

| Format           | CLI Flag                                    | Description                           |
| ---------------- | ------------------------------------------- | ------------------------------------- |
| Console (pretty) | default                                     | Colored terminal output with summary  |
| JSON             | `--json` or `--report report.json`         | Machine-readable structured data      |
| HTML             | `--report baseline-report.html`            | Interactive web report with filtering |
| SARIF 2.1.0      | `--report baseline-report.sarif`           | GitHub Code Scanning integration      |

The HTML report includes client-side filtering, sorting, and search capabilities. SARIF files integrate with GitHub Code Scanning and other security tools.

## 🚦 Exit Codes

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | No non-Baseline findings (or `--exit-zero` specified) |
| 1    | At least one non-Baseline finding detected            |
| >1   | Internal error occurred                                |

## 🔧 GitHub Actions Usage

Minimal workflow using the published CLI:

```yaml
name: Baseline Scan
on:
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch: {}

permissions:
  contents: read
  security-events: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Baseline scan (HTML + SARIF)
        run: |
          npx @whoisahmad/baseline-tools-cli . --report baseline-report.html --exit-zero
          npx @whoisahmad/baseline-tools-cli . --report baseline-report.sarif --exit-zero
      - name: Upload HTML
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: baseline-html-report
          path: baseline-report.html
      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: baseline-report.sarif
```

## ⚙️ Configuration

Create a `baseline.config.json` at the repo root (or pass with `--config`):

```json
{
  "$schema": "./docs/schema/baseline.config.schema.json",
  "targets": ">0.5% and not dead",
  "unsupportedThreshold": 5,
  "ignore": ["**/dist/**", "**/node_modules/**"],
  "features": {
    "urlpattern": true,
    "css-has": true
  }
}
```

Configuration options:
- `targets`: Override `browserslist` targets
- `unsupportedThreshold`: Reclassify "needs-guard" to "safe" when unsupported% ≤ threshold
- `ignore`: Additional glob patterns to skip (CLI only)
- `features`: Per-feature toggles; set to `false` to disable specific detectors

## 🔍 Code Scanning (SARIF)

Generate SARIF with the CLI and upload to GitHub Code Scanning:

```yaml
- name: Generate SARIF
  run: npx @whoisahmad/baseline-tools-cli . --report baseline-report.sarif --exit-zero
- name: Upload SARIF to Code Scanning
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: baseline-report.sarif
```

## 🧪 Testing

Run all tests from the repo root:

```bash
npm run build
npm run test
```

The project uses Node's built-in test runner for fast, clean test execution. Tests cover:
- Core analysis functionality
- CLI scanning with various output formats
- SARIF generation and structure
- Configuration parsing and validation

CI runs tests on Windows, macOS, and Linux across Node 18, 20, and 22.

## 🎯 Demo & Examples

The `examples/demo-repo` includes sample code that triggers various findings:

```bash
# Pretty scan (non-failing)
npm run scan

# Strict scan (exits non-zero when issues found)
npm run scan:strict

# Generate reports
npm run scan:json
npm run scan:report
```

## 📚 Documentation

- [Incremental Scanning](./docs/incremental-scanning.md) - Using `--changed` for PR workflows
- [Publishing Extension](./docs/publishing-extension.md) - VS Code Marketplace publishing
- [Releasing](./docs/releasing.md) - Version management with Changesets
- [Recipes](./docs/recipes/) - Guard/fallback patterns for common scenarios

## ⚠️ Notes & Limitations

- Detectors use regex patterns for a curated feature set; false positives/negatives are possible
- Target coverage uses caniuse-lite with approximate percentages
- Partial browser support (caniuse "a") is treated as supported
- Guard detection recognizes simple patterns but may miss complex conditional logic

## 🗺️ Roadmap

**Current Status**: CLI and VS Code extension stable with HTML & SARIF reporting

**Planned Features**:
- 🔍 Broader detector coverage (container queries, popover, import attributes)
- 📊 Improved accuracy with browser-compat-data integration
- 🏷️ SARIF category support for multi-scan pipelines
- 🧙 Configuration wizard (`npx baseline-scan --init`)
- ⚡ Performance optimizations and cache improvements

Have a feature request? [Open an issue](https://github.com/ahmad-04/baselineProject/issues)!

## 📄 License

MIT - see [LICENSE](./LICENSE) file for details.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and open an issue first to discuss proposed changes.

1. Fork the repository
2. Create a feature branch
3. Run `npm install && npm run build`
4. Make your changes with tests
5. Run `npm test` to verify
6. Submit a pull request