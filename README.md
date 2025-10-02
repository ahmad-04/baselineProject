# Baseline Guardrails

[![Tests](https://github.com/ahmad-04/baselineProject/actions/workflows/tests.yml/badge.svg)](https://github.com/ahmad-04/baselineProject/actions/workflows/tests.yml)

Guardrails that bring Baseline data to where developers work: CLI, ESLint, VS Code, and GitHub PR comments, all powered by a shared core analyzer.

- Core: `baseline-tools-core` — regex-based detectors for modern web features, advice/guard flags, target-aware hints.
- CLI: `baseline-scan` — pretty/JSON output, HTML adoption report, diff-only scanning.
- ESLint: `eslint-plugin-baseline` — rule `baseline/no-nonbaseline` with suggestions, guard‑aware suppression.
- VS Code: `baseline-guardrails-vscode` — diagnostics, hover, quick fixes, status bar, scan toggle, and Targets/Threshold picker.
- Action: `baseline-tools-action` — compact PR summary (top findings), optional HTML report artifact, and SARIF output.
- SARIF: CLI/Action can emit SARIF 2.1.0 for GitHub Code Scanning.

## Features

- Advice labels: “Safe to adopt”, “Guarded”, “Needs guard”. Guarded code counts as safe in totals.
- Target-aware hints: Reads `browserslist` and shows “about X% may lack support” (approximate via caniuse-lite).
- Guard-aware suppression: ESLint rule and VS Code diagnostics skip issues already wrapped in capability checks.
- HTML Adoption Report: Shareable report with targets, totals, advice, suggestions, and docs links.
- SARIF Output: Use in security/code scanning dashboards.
- Helpers: Drop-in capability checks to make guards trivial to add.
- Config: `baseline.config.json` to centralize targets, thresholds, ignores, and feature toggles.

## Quick Start

1. Install and build

```bash
npm install
npm run build
```

2. Run the CLI (pretty)

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

4. GitHub Action (already wired)

The workflow `.github/workflows/baseline-guard.yml` builds, scans, posts a compact PR summary, uploads the HTML report, and uploads SARIF to GitHub Code Scanning.

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

## ESLint Rule

Flat config example (ESLint v9):

```js
// eslint.config.js
import baseline from "../packages/eslint-plugin-baseline/dist/index.js"; // adjust path if using as a local plugin

export default [
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: { baseline },
    rules: {
      // Options override baseline.config.json
      "baseline/no-nonbaseline": [
        "warn",
        {
          targets: ">0.5% and not dead", // string or string[]
          unsupportedThreshold: 5, // number; reclassify <= threshold as Safe
          features: { urlpattern: true }, // per-feature toggles
        },
      ],
    },
  },
];
```

- Reads `browserslist` (nearest `package.json`) and passes targets to the analyzer.
- Message includes advice label; suggestions add non‑destructive guard/fallback templates.
- Guarded usages are skipped (no warning).
- Options precedence: ESLint rule options > `baseline.config.json` > nearest package `browserslist`.

## VS Code Extension

Capabilities:

- Diagnostics for non‑Baseline features (guarded ones suppressed).
- Hover with suggestion, docs, and current targets.
- Quick fixes insert guard/fallback snippets.
- Status bar shows counts, targets, scan mode, and analysis mode (lsp/local).
- Commands: `Baseline: Scan Workspace`, `Baseline: Toggle Scan Mode (change/save)`, `Baseline: Pick Targets/Threshold`, `Baseline: Fix all in file`, `Baseline: Restart LSP (experimental)`.

Run from this repo: use the provided launch config “Run Extension (baseline-guardrails)” and press F5.

### VS Code Settings

- `baseline.scanOnChange`: Scan on every edit (`true`) or only on save (`false`). Togglable via “Baseline: Toggle Scan Mode (change/save)”.
- `baseline.targets`: Optional override for Browserslist targets used in analysis. When set, takes precedence over `baseline.config.json` and nearest package `browserslist`.
- `baseline.unsupportedThreshold`: Optional number; when `>= 0`, findings with unsupported% less than or equal to this threshold are treated as Safe in diagnostics.
- `baseline.useLsp` (experimental): Use the bundled stdio LSP server for analysis. The extension debounces per-document requests and falls back to local analysis if the server is unavailable or slow. You can restart via the `Baseline: Restart LSP (experimental)` command.

Status bar shows: count of diagnostics • current targets (or `auto`) • scan mode (`change`/`save`) • analysis mode (`lsp`/`local`).

### VS Code Usage

1. Open a JS/TS/HTML/CSS file with modern features. Diagnostics appear inline.
2. Hover a highlighted range to view advice, docs, and targets.
3. Use Quick Fix to insert a guard/fallback snippet, or run `Baseline: Fix all in file` to insert suggestions for all findings.
4. Toggle scan mode via Command Palette: “Baseline: Toggle Scan Mode (change/save)”.
5. Pick targets/threshold via Command Palette: “Baseline: Pick Targets/Threshold”.
6. (Optional) Enable LSP mode in Settings (`baseline.useLsp`) and use “Baseline: Restart LSP (experimental)” if you update or restart the server.

Screenshots:

- VS Code diagnostics and status bar: `docs/images/vscode-status.svg`
- Quick Fix example: `docs/images/vscode-quickfix.svg`
- HTML report: `docs/images/html-report.svg`
- Code Scanning alert: `docs/images/code-scanning.svg`

## Helpers

Package: `baseline-tools-helpers`

- `canShare()`: checks `navigator.share` availability
- `canParseUrl(url)`: uses `URL.canParse` when available, falls back to `new URL()`
- `hasViewTransitions()`: checks `document.startViewTransition`
- `canShowOpenFilePicker()`: checks `window.showOpenFilePicker`

Example:

```ts
import { canShare } from "baseline-tools-helpers";

async function sharePage() {
  if (canShare()) {
    await navigator.share({ title: document.title, url: location.href });
  } else {
    // fallback UI
  }
}
```

## GitHub Action

Local action `packages/action` posts a compact PR summary and, by default, generates an HTML report. It can also generate SARIF for Code Scanning.

Inputs:

- `github-token` (optional, string): enables diff‑only scanning and PR comments.
- `path` (string): folder to scan.
- `generate-html-report` (optional, default `true`): write HTML report.
- `report-html-path` (optional, default `baseline-report.html`): where to save it.
- `generate-sarif-report` (optional, default `true`): write SARIF report for Code Scanning.
- `report-sarif-path` (optional, default `baseline-report.sarif`): where to save SARIF.

Outputs:

- `html-report`: path to the generated HTML file.
- `sarif-report`: path to the generated SARIF file.

Workflow snippet:

```yaml
- name: Baseline Guard summary + reports
  uses: ./packages/action
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    path: examples/demo-repo
    generate-html-report: true
    generate-sarif-report: true

- name: Upload HTML report (if generated)
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: baseline-html-report
    path: examples/demo-repo/baseline-report.html

- name: Upload SARIF to Code Scanning
  if: always()
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: examples/demo-repo/baseline-report.sarif
```

### Use in other repositories

You can consume this Action from any repo by referencing this repository and the `packages/action` path at a tag:

```yaml
name: Baseline Guard

on:
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch: {}

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Baseline Guard summary + reports
        uses: ahmad-04/baselineProject/packages/action@action-v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          path: .
          generate-html-report: true
          generate-sarif-report: true
      - name: Upload HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: baseline-html-report
          path: baseline-report.html
      - name: Upload SARIF to Code Scanning
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: baseline-report.sarif
```

Notes:

- The `@action-v0` tag is a moving major tag you can update when releasing. Consumers may also pin to a specific tag like `@action-v0.1.0` or a commit SHA.
- The Action invokes the published CLI via `npx baseline-tools-cli`.

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

## Status

MVP complete: Core + CLI + ESLint + VS Code + Action + HTML report. Next steps: expand feature coverage mapping, add helper utilities (guard wrappers), richer HTML summaries, and broaden detectors.
