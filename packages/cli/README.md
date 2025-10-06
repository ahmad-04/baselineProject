# @whoisahmad/baseline-tools-cli# Baseline Scan CLI



Command-line scanner for detecting non-Baseline web platform features in JavaScript, TypeScript, CSS, and HTML files. Generates comprehensive reports in multiple formats including HTML, JSON, and SARIF for GitHub Code Scanning integration.Command-line scanner for detecting non-Baseline web platform features in JS/TS/CSS/HTML. Produces pretty console output, JSON, HTML adoption reports, and SARIF for GitHub Code Scanning.



[![npm version](https://img.shields.io/npm/v/@whoisahmad/baseline-tools-cli.svg)](https://www.npmjs.com/package/@whoisahmad/baseline-tools-cli)Shares the analyzer with `@whoisahmad/baseline-tools-core` and is used by the GitHub Action.



## 🚀 Quick Start## Install



### InstallationGlobal (optional):



```bash```bash

# Install as dev dependency (recommended)npm install -g @whoisahmad/baseline-tools-cli

npm install -D @whoisahmad/baseline-tools-cli```



# Install globally (optional)Project dev dependency:

npm install -g @whoisahmad/baseline-tools-cli

```bash

# Run without installationnpm install -D @whoisahmad/baseline-tools-cli

npx @whoisahmad/baseline-tools-cli ./src```

```

Ad-hoc (no install):

### Basic Usage

```bash

```bashnpx baseline-scan .

# Scan current directory with pretty output```

baseline-scan .

## Usage

# Generate HTML report (non-failing)

baseline-scan ./src --report baseline-report.html --exit-zero```bash

baseline-scan <path> [options]

# Generate SARIF for GitHub Code Scanning```

baseline-scan ./src --report baseline-report.sarif --exit-zero

Key options:

# JSON output for programmatic use

baseline-scan ./src --json --exit-zero| Flag                          | Description                                              |

```| ----------------------------- | -------------------------------------------------------- |

| `--json`                      | Print full JSON report to stdout.                        |

## 🛠️ CLI Reference| `--report <file>`             | Write report (JSON / HTML / SARIF based on extension).   |

| `--exit-zero`                 | Force exit code 0 (CI summaries without failing builds). |

```bash| `--files <csv>`               | Restrict scan to specific globs (e.g., changed files).   |

baseline-scan <path> [options]| `--unsupported-threshold <n>` | Reclassify "needs-guard" to safe if unsupported% ≤ n.    |

```| `--config <path>`             | Explicit `baseline.config.json` path.                    |

| `--changed`                   | Scan only changed (vs HEAD) + untracked files.           |

### Options| `--since <ref>`               | Base ref for `--changed` (default HEAD).                 |

| `--cache`                     | Enable content-hash cache (v3).                          |

| Flag                          | Description                                              || `--cache-file <path>`         | Custom cache filename.                                   |

| ----------------------------- | -------------------------------------------------------- |

| `--json`                      | Print full JSON report to stdout                        |## Examples

| `--report <file>`             | Write report (JSON / HTML / SARIF based on extension)   |

| `--exit-zero`                 | Force exit code 0 (CI summaries without failing builds) |Pretty scan (non-failing):

| `--files <csv>`               | Restrict scan to specific globs (e.g., changed files)   |

| `--unsupported-threshold <n>` | Reclassify "needs-guard" to safe if unsupported% ≤ n    |```bash

| `--config <path>`             | Explicit `baseline.config.json` path                    |baseline-scan src --exit-zero

| `--changed`                   | Scan only changed (vs HEAD) + untracked files           |```

| `--since <ref>`               | Base ref for `--changed` (default HEAD)                 |

| `--cache`                     | Enable content-hash cache (v3)                          |Generate HTML + SARIF:

| `--cache-file <path>`         | Custom cache filename                                    |

```bash

## 📋 Examplesbaseline-scan src --report baseline-report.html --exit-zero

baseline-scan src --report baseline-report.sarif --exit-zero

### Development Workflow```



```bashJSON plus write HTML:

# Pretty scan during development

baseline-scan src --exit-zero```bash

baseline-scan src --json --report baseline-report.html --exit-zero > baseline-report.json

# Scan only changed files (great for pre-commit hooks)```

baseline-scan . --changed --exit-zero

Changed files only (relative to `origin/main`):

# Generate both HTML and JSON reports

baseline-scan src --json --report baseline-report.html --exit-zero > baseline-report.json```bash

```baseline-scan . --changed --since origin/main --report baseline-report.html --exit-zero

```

### CI/CD Integration

Apply unsupported threshold (treat ≤5% unsupported as safe):

```bash

# GitHub Actions - generate reports and upload```bash

baseline-scan . --report baseline-report.html --exit-zerobaseline-scan src --unsupported-threshold 5

baseline-scan . --report baseline-report.sarif --exit-zero```



# Apply threshold - treat ≤5% unsupported as safe## Configuration Resolution Order

baseline-scan src --unsupported-threshold 5

1. CLI flags (`--unsupported-threshold`, etc.)

# Scan specific file patterns2. `baseline.config.json` (searched upward from scan path)

baseline-scan . --files "src/**/*.ts,src/**/*.css" --exit-zero3. `browserslist` in nearest `package.json`



# Compare against specific branch## Exit Codes

baseline-scan . --changed --since origin/main --exit-zero

```| Code | Meaning                                           |

| ---- | ------------------------------------------------- |

### Configuration Usage| 0    | No non-Baseline findings (or `--exit-zero` used). |

| 1    | At least one non-Baseline finding.                |

```bash| >1   | Internal error (stack logged).                    |

# Use custom config file

baseline-scan src --config ./custom-baseline.config.json## HTML Report



# Override specific settingsInteractive table with filtering, search, and sorting. Shares the same structure as the Action artifact for consistency.

baseline-scan src --unsupported-threshold 10 --exit-zero

```## SARIF



## ⚙️ ConfigurationOutputs a minimal SARIF 2.1.0 file with each feature instance mapped to a rule. Upload with `github/codeql-action/upload-sarif`.



The tool looks for `baseline.config.json` starting from the scan path and walking up the directory tree.## Caching



```json`--cache` creates/updates a JSON file (default `.baseline-scan-cache.json`) keyed by content hash and config hash (`targets`, `unsupportedThreshold`). Safe to commit or ignore; usually add to `.gitignore`.

{

  "$schema": "../docs/schema/baseline.config.schema.json",## Developing Locally

  "targets": ">0.5% and not dead",

  "unsupportedThreshold": 5,```bash

  "ignore": ["**/dist/**", "**/node_modules/**"],npm install

  "features": {npm run build

    "urlpattern": true,node packages/cli/dist/index.js examples/demo-repo --report baseline-report.html --exit-zero

    "css-has": true,```

    "view-transitions": false

  }## License

}

```MIT


### Configuration Resolution Order

1. CLI flags (`--unsupported-threshold`, etc.)
2. `baseline.config.json` (searched upward from scan path)
3. `browserslist` in nearest `package.json`
4. Built-in defaults

## 📊 Output Formats

### Console (Default)
Colored, human-readable output with:
- Summary statistics
- Target browser information
- Categorized findings with advice labels
- File-by-file breakdown

### JSON (`--json` or `--report file.json`)
Machine-readable structured data including:
- Complete finding details with locations
- Browser compatibility data
- Guard detection results
- Configurable metadata

### HTML (`--report file.html`)
Interactive web report featuring:
- Sortable and filterable tables
- Client-side search functionality
- Target browser visualization
- Detailed finding descriptions with docs links
- Shareable standalone file

### SARIF (`--report file.sarif`)
Security scanning format (SARIF 2.1.0) for:
- GitHub Code Scanning integration
- IDE security panel display
- Security tool chain compatibility
- Automated policy enforcement

## 🚦 Exit Codes

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 0    | No non-Baseline findings (or `--exit-zero` used) |
| 1    | At least one non-Baseline finding detected       |
| >1   | Internal error (stack trace logged)              |

## 💾 Caching

Enable caching for faster subsequent scans:

```bash
# Enable cache (creates .baseline-scan-cache.json)
baseline-scan src --cache

# Custom cache location
baseline-scan src --cache --cache-file .custom-cache.json
```

Cache is keyed by:
- File content hashes
- Configuration settings (`targets`, `unsupportedThreshold`)
- Tool version

Safe to commit cache files or add to `.gitignore` as needed.

## 🔗 Integration Examples

### GitHub Actions

```yaml
name: Baseline Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Scan for non-baseline features
        run: |
          npx @whoisahmad/baseline-tools-cli . --report baseline-report.html --exit-zero
          npx @whoisahmad/baseline-tools-cli . --report baseline-report.sarif --exit-zero
      - name: Upload reports
        uses: actions/upload-artifact@v4
        with:
          name: baseline-reports
          path: baseline-report.*
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: baseline-report.sarif
```

### npm Scripts

```json
{
  "scripts": {
    "baseline": "baseline-scan src --exit-zero",
    "baseline:report": "baseline-scan src --report baseline-report.html --exit-zero",
    "baseline:ci": "baseline-scan src --report baseline-report.sarif",
    "baseline:changed": "baseline-scan . --changed --exit-zero"
  }
}
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
npx @whoisahmad/baseline-tools-cli . --changed --exit-zero
```

## 🎯 Advanced Usage

### Incremental Scanning

Perfect for large repositories and PR workflows:

```bash
# Scan only files changed in this branch
baseline-scan . --changed --since origin/main

# Include untracked files
baseline-scan . --changed --exit-zero

# Combine with specific file patterns
baseline-scan . --changed --files "src/**/*.ts" --exit-zero
```

### Threshold Tuning

Fine-tune what counts as "safe" based on your support requirements:

```bash
# Treat features with ≤3% unsupported browsers as safe
baseline-scan src --unsupported-threshold 3

# Conservative: only widely supported features
baseline-scan src --unsupported-threshold 0

# Aggressive: accept up to 10% lack of support
baseline-scan src --unsupported-threshold 10
```

## 🐛 Troubleshooting

### Common Issues

**No files found to scan:**
- Check that the path exists and contains supported file types (`.js`, `.ts`, `.css`, `.html`)
- Verify ignore patterns in `baseline.config.json` aren't too broad

**Cache issues:**
- Delete cache file and re-run: `rm .baseline-scan-cache.json`
- Use `--cache-file` to specify a different location

**Performance with large repos:**
- Use `--files` to limit scope
- Enable `--cache` for subsequent runs
- Consider `--changed` for PR workflows

### Debug Information

Add debug output by setting environment variable:

```bash
DEBUG=baseline-scan baseline-scan src
```

## 🔧 Development

For local development and testing:

```bash
# Clone and setup
git clone https://github.com/ahmad-04/baselineProject.git
cd baselineProject
npm install
npm run build

# Test locally
node packages/cli/dist/index.js examples/demo-repo --report test-report.html --exit-zero
```

## 📄 License

MIT - see [LICENSE](../../LICENSE) for details.

## 🔗 Related

- [Baseline Guardrails VS Code Extension](../vscode-extension) - Real-time diagnostics in your editor
- [Main Project README](../../README.md) - Complete project documentation
- [Web Features Baseline](https://web.dev/baseline/) - Learn about Baseline web features