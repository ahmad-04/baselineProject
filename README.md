# Baseline Guardrails

Guardrails that bring Baseline data to where developers work: CLI, ESLint, VS Code, and GitHub PR comments, all powered by a shared core analyzer.

- Core: `@baseline-tools/core` — regex-based detectors for modern web features, advice/guard flags, target-aware hints.
- CLI: `baseline-scan` — pretty/JSON output, HTML adoption report, diff-only scanning.
- ESLint: `eslint-plugin-baseline` — rule `baseline/no-nonbaseline` with suggestions, guard‑aware suppression.
- VS Code: `baseline-guardrails-vscode` — diagnostics, hover, quick fixes, “Scan workspace” command.
- Action: `@baseline-tools/action` — PR bot summary with code snippets; optional HTML report artifact.

## Features

- Advice labels: “Safe to adopt”, “Guarded”, “Needs guard”. Guarded code counts as safe in totals.
- Target-aware hints: Reads `browserslist` and shows “about X% may lack support” (approximate via caniuse-lite).
- Guard-aware suppression: ESLint rule and VS Code diagnostics skip issues already wrapped in capability checks.
- HTML Adoption Report: Shareable report with targets, totals, advice, suggestions, and docs links.

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

4. GitHub Action (already wired)

The workflow `.github/workflows/baseline.yml` builds, scans, uploads a JSON artifact, posts a PR comment, and uploads the HTML report.

## CLI Usage

```bash
baseline-scan <path> [--json] [--report <file>] [--exit-zero] [--files <csv>]
```

- `--json`: print JSON report to stdout
- `--report <file>`: write JSON when `<file>` is `.json` or HTML when `.html`
- `--exit-zero`: never fail the process (useful for CI summaries)
- `--files <csv>`: only scan the provided files/globs (used for PR diffs)

Notes:

- The CLI reads `browserslist` from the scanned path’s `package.json` when present.
- Totals treat Guarded findings as safe.

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
      "baseline/no-nonbaseline": "warn",
    },
  },
];
```

- Reads `browserslist` (nearest `package.json`) and passes targets to the analyzer.
- Message includes advice label; suggestions add non‑destructive guard/fallback templates.
- Guarded usages are skipped (no warning).

## VS Code Extension

Capabilities:

- Diagnostics for non‑Baseline features (guarded ones suppressed).
- Hover with suggestion, docs, and current `browserslist` targets.
- Quick fixes insert guard/fallback snippets.
- Command: `Baseline: Scan Workspace`.

Run from this repo: use the provided launch config “Run Extension (baseline-guardrails)” and press F5.

## GitHub Action

Local action `packages/action` posts a PR summary and, by default, generates an HTML report.

Inputs:

- `github-token` (optional, string): enables diff‑only scanning and PR comments.
- `path` (string): folder to scan.
- `generate-html-report` (optional, default `true`): write HTML report.
- `report-html-path` (optional, default `baseline-report.html`): where to save it.

Outputs:

- `html-report`: path to the generated HTML file.

Workflow snippet:

```yaml
- name: Baseline Guard comment
	uses: ./packages/action
	with:
		github-token: ${{ secrets.GITHUB_TOKEN }}
		path: examples/demo-repo
- name: Upload HTML report (if generated)
	if: always()
	uses: actions/upload-artifact@v4
	with:
		name: baseline-html-report
		path: examples/demo-repo/baseline-report.html
```

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
```

On Windows, open the HTML report with:

```bash
explorer.exe C:\\Github_projects\\baselineProject\\examples\\demo-repo\\baseline-report.html
```

## Notes & Limitations

- Detectors are regex‑based for a curated feature set; false positives/negatives are possible.
- Target coverage uses caniuse‑lite and a minimal feature mapping; percentages are approximate and may be refined.
- Partial support (caniuse “a”) is treated as supported for guidance.

## Status

MVP complete: Core + CLI + ESLint + VS Code + Action + HTML report. Next steps: expand feature coverage mapping, add helper utilities (guard wrappers), richer HTML summaries, and broaden detectors.
