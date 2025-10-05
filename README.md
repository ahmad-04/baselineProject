# Baseline Scan CLI

<p align="left">
  <a href="https://www.npmjs.com/package/@whoisahmad/baseline-tools-cli"><img alt="CLI version" src="https://img.shields.io/npm/v/%40whoisahmad%2fbaseline-tools-cli.svg?label=baseline-scan" /></a>
</p>

Single purpose: scan your source for non‑Baseline web platform features and produce actionable reports (console, JSON, HTML, SARIF).

Previously this monorepo published multiple packages (core analyzer, ESLint plugin, helpers, LSP, GitHub Action). They are now internal / retired. Only the CLI package is published going forward.

[![Tests](https://github.com/ahmad-04/baselineProject/actions/workflows/tests.yml/badge.svg)](https://github.com/ahmad-04/baselineProject/actions/workflows/tests.yml)

## Features (CLI)

- Advice labels: “Safe to adopt”, “Guarded”, “Needs guard”. Guarded code counts as safe in totals.
- Target-aware hints: Reads `browserslist` and shows “about X% may lack support” (approximate via caniuse-lite).
- Guard-aware suppression (recognizes simple capability guards to downgrade severity).
- HTML Adoption Report: Shareable report with targets, totals, advice, suggestions, and docs links.
- SARIF Output: Use in Code Scanning dashboards.
- Config: `baseline.config.json` centralizes targets, thresholds, ignores, and feature toggles.

## Quick Start

### Installation

Install (dev dependency) or run ad‑hoc with npx.

Install:

```bash
npm install -D @whoisahmad/baseline-tools-cli
```

Ad‑hoc (no install):

```bash
npx baseline-scan ./src --report baseline-report.html --exit-zero
```

---

1. Install and build

```bash
npm install
npm run build
```

2. Run a pretty scan

```bash
node packages/cli/dist/index.js examples/demo-repo
```

3. JSON + HTML reports

```bash
# JSON to stdout and file
node packages/cli/dist/index.js examples/demo-repo --json --report baseline-report.json --exit-zero

# HTML adoption report (saved relative to current directory)
node packages/cli/dist/index.js examples/demo-repo --report baseline-report.html --exit-zero
```

4. SARIF report (for GitHub Code Scanning)

```bash
node packages/cli/dist/index.js examples/demo-repo --report baseline-report.sarif --exit-zero
```

5. (Optional) SARIF upload with your own workflow (see Code Scanning section).

## CLI Usage

```bash
baseline-scan <path> [--json] [--report <file>] [--exit-zero] [--files <csv>] [--unsupported-threshold <n>] [--config <path>]
```

- `--json`: print JSON report to stdout
- `--report <file>`: write JSON when `<file>` is `.json`, HTML when `.html`, SARIF when `.sarif`
- `--exit-zero`: never fail the process (useful for CI summaries)
- `--files <csv>`: only scan the provided files/globs (used for PR diffs)
- `--unsupported-threshold <n>`: treat “needs-guard” as “safe” when unsupported percentage is `<= n`
- `--config <path>`: path to `baseline.config.json` to override defaults
- `--changed`: scan only files changed vs `HEAD` (includes untracked)
- `--since <ref>`: use a different base ref for `--changed` (e.g., `origin/main`)
- `--cache`: enable content‑hash cache (v3) for faster subsequent runs
- `--cache-file <path>`: custom cache file location (default: `.baseline-scan-cache.json`)

Notes:

- The CLI reads `browserslist` from the scanned path’s `package.json` when present.
- Totals treat Guarded findings as safe.
- With `--changed` and no modified files, the CLI exits 0 and writes an empty report if `--report` is provided.

See also: `docs/incremental-scanning.md`.

## Retired Packages (Internal Only)

Historical packages (now private / not updated): `core`, `helpers`, `eslint-plugin-baseline`, `lsp-server`, `action`, and the VS Code extension. Their functionality is either folded into or superseded by the CLI workflow. If you need one resurrected, open an issue.

## Output Formats

| Format           | How                                         |
| ---------------- | ------------------------------------------- |
| Console (pretty) | default run                                 |
| JSON             | `--json` (stdout) or `--report report.json` |
| HTML             | `--report baseline-report.html`             |
| SARIF 2.1.0      | `--report baseline-report.sarif`            |

Notes:

- The HTML report includes filtering, sorting, and search (client-side only).
- SARIF integrates with GitHub Code Scanning (`upload-sarif`).

## Exit Codes

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | No non‑Baseline findings (or `--exit-zero` specified). |
| 1    | At least one non‑Baseline finding.                     |
| >1   | Internal error.                                        |

## GitHub Actions Usage (CLI Only)

Minimal workflow using only the published CLI (no separate Action package needed):

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

## Configuration

Create a `baseline.config.json` at the repo root (or pass with `--config`). All tools (CLI, ESLint rule, VS Code extension) look up from the current file/scan path and honor these settings.

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

Notes:

- `targets`: overrides `browserslist` targets.
- `unsupportedThreshold`: reclassifies "needs-guard" to "safe" when unsupported% ≤ threshold (affects CLI totals, ESLint messaging, and VS Code diagnostics labels).
- `ignore`: additional glob patterns to skip (CLI only).
- `features`: per-feature toggles; set to `false` to hide/suppress a detector across tools.

## Code Scanning (SARIF)

Generate SARIF with the CLI and upload to GitHub Code Scanning:

```yaml
- name: Generate SARIF
  run: node packages/cli/dist/index.js examples/demo-repo --report baseline-report.sarif --exit-zero
- name: Upload SARIF to Code Scanning
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: baseline-report.sarif
```

## Releasing

See `docs/releasing.md` for the Changesets-based flow (versioning + npm publish) and packaging the VS Code extension (`.vsix`).

## Testing

Run all tests from the repo root using Node’s built-in test runner:

```bash
cd C:/Github_projects/baselineProject
npm run build
npm run test
```

Notes:

- Uses `node --test` (no watch) for fast, clean exits.
- Core tests run under `packages/core/test/**/*.js`.
- CLI tests exercise SARIF output and `--unsupported-threshold` behavior.
- Action and ESLint packages currently have no tests; their `test` scripts are no-ops.
- CLI scanning uses stable Windows-friendly absolute paths and `globby` with `cwd` to avoid path issues.

CI:

- GitHub Actions runs tests on Windows, macOS, and Linux across Node 18, 20, and 22.

## Demo Repo

The `examples/demo-repo` includes code that triggers findings (JS/CSS/HTML). Helpful scripts:

```bash
# Pretty scan (non-failing)
npm run scan

# Strict scan (non-zero exit when non-Baseline found)
npm run scan:strict

# JSON report
npm run scan:json

# Write JSON or HTML report
npm run scan:report
node ../../packages/cli/dist/index.js src --report baseline-report.html --exit-zero

# Write SARIF report
node ../../packages/cli/dist/index.js src --report baseline-report.sarif --exit-zero
```

On Windows, open the HTML report with:

```bash
explorer.exe C:\\Github_projects\\baselineProject\\examples\\demo-repo\\baseline-report.html
```

## Recipes

Practical guard/fallback examples are in `docs/recipes/`.

## Notes & Limitations

- Detectors are regex‑based for a curated feature set; false positives/negatives are possible.
- Target coverage uses caniuse‑lite and a minimal feature mapping; percentages are approximate and may be refined.
- Partial support (caniuse “a”) is treated as supported for guidance.

## Status & Roadmap (CLI Focus)

Current: CLI + analyzer internal. HTML & SARIF reporting stable.

Planned:

- Broaden detector set (container queries, popover, import attributes, etc.).
- Improve unsupported % accuracy (browser-compat-data integration).
- `--sarif-category` for multi-scan pipelines.
- Config wizard (`npx baseline-scan --init`).
- Performance benchmarks & cache heuristics refinement.

Have a request? Open an issue.
