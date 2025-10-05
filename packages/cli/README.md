# Baseline Scan CLI

Command-line scanner for detecting non-Baseline web platform features in JS/TS/CSS/HTML. Produces pretty console output, JSON, HTML adoption reports, and SARIF for GitHub Code Scanning.

Shares the analyzer with `@whoisahmad/baseline-tools-core` and is used by the GitHub Action.

## Install

Global (optional):

```bash
npm install -g @whoisahmad/baseline-tools-cli
```

Project dev dependency:

```bash
npm install -D @whoisahmad/baseline-tools-cli
```

Ad-hoc (no install):

```bash
npx baseline-scan .
```

## Usage

```bash
baseline-scan <path> [options]
```

Key options:

| Flag | Description |
|------|-------------|
| `--json` | Print full JSON report to stdout. |
| `--report <file>` | Write report (JSON / HTML / SARIF based on extension). |
| `--exit-zero` | Force exit code 0 (CI summaries without failing builds). |
| `--files <csv>` | Restrict scan to specific globs (e.g., changed files). |
| `--unsupported-threshold <n>` | Reclassify "needs-guard" to safe if unsupported% ≤ n. |
| `--config <path>` | Explicit `baseline.config.json` path. |
| `--changed` | Scan only changed (vs HEAD) + untracked files. |
| `--since <ref>` | Base ref for `--changed` (default HEAD). |
| `--cache` | Enable content-hash cache (v3). |
| `--cache-file <path>` | Custom cache filename. |

## Examples

Pretty scan (non-failing):

```bash
baseline-scan src --exit-zero
```

Generate HTML + SARIF:

```bash
baseline-scan src --report baseline-report.html --exit-zero
baseline-scan src --report baseline-report.sarif --exit-zero
```

JSON plus write HTML:

```bash
baseline-scan src --json --report baseline-report.html --exit-zero > baseline-report.json
```

Changed files only (relative to `origin/main`):

```bash
baseline-scan . --changed --since origin/main --report baseline-report.html --exit-zero
```

Apply unsupported threshold (treat ≤5% unsupported as safe):

```bash
baseline-scan src --unsupported-threshold 5
```

## Configuration Resolution Order

1. CLI flags (`--unsupported-threshold`, etc.)
2. `baseline.config.json` (searched upward from scan path)
3. `browserslist` in nearest `package.json`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No non-Baseline findings (or `--exit-zero` used). |
| 1 | At least one non-Baseline finding. |
| >1 | Internal error (stack logged). |

## HTML Report

Interactive table with filtering, search, and sorting. Shares the same structure as the Action artifact for consistency.

## SARIF

Outputs a minimal SARIF 2.1.0 file with each feature instance mapped to a rule. Upload with `github/codeql-action/upload-sarif`.

## Caching

`--cache` creates/updates a JSON file (default `.baseline-scan-cache.json`) keyed by content hash and config hash (`targets`, `unsupportedThreshold`). Safe to commit or ignore; usually add to `.gitignore`.

## Developing Locally

```bash
npm install
npm run build
node packages/cli/dist/index.js examples/demo-repo --report baseline-report.html --exit-zero
```

## License

MIT
