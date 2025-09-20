# Baseline Guardrails

Guardrails that bring Baseline data to where developers work: CLI and GitHub PR comments, powered by a shared core analyzer.

- Core: `@baseline-tools/core` — analyzes code and maps tokens to modern web features.
- CLI: `baseline-scan` — scan a path, print findings (pretty and JSON).
- Action: `@baseline-tools/action` — PR bot that summarizes non‑Baseline features with suggestions.

## Quick Start

1. Install and build

```bash
npm install
npm run build
```

2. Run the CLI (pretty output)

```bash
node packages/cli/dist/index.js examples/demo-repo
```

3. JSON output for CI and artifacts

```bash
node packages/cli/dist/index.js examples/demo-repo --json --report baseline-report.json --exit-zero
```

4. GitHub Action (already wired)

The root workflow `.github/workflows/baseline.yml` builds packages, runs a scan, uploads a JSON artifact, and invokes the local Action to post a PR comment.

## CLI Usage

```bash
baseline-scan <path> [--json] [--report <file>] [--exit-zero] [--files <csv>]
```

- `--json`: print a JSON report to stdout
- `--report <file>`: also write the JSON to disk
- `--exit-zero`: never fail the process (useful for CI summaries)
- `--files <csv>`: only scan these paths/globs (used for PR diffs)

The CLI reads `browserslist` from the scanned path’s `package.json` when present.

## Action Usage

The Action runs the CLI with `--json` and posts a structured comment on PRs. It auto-detects changed files and scans only those when possible.

```yaml
- name: Baseline Guard comment
	uses: ./packages/action
	with:
		github-token: ${{ secrets.GITHUB_TOKEN }}
		path: examples/demo-repo
```

## Demo Repo

`examples/demo-repo` includes sample JS/CSS/HTML using modern features (e.g., `:has()`, `@container`, `structuredClone`, `navigator.share`). Run the CLI against it to see findings.

To try the ESLint rule in the demo repo:

```bash
cd examples/demo-repo
npm install
npm run lint
```

## Status

MVP working: end-to-end CLI + Action, JSON output, curated detectors. Next: tuning severities by targets, more features, docs polish, and an ESLint rule.
