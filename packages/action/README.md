# Baseline Guard GitHub Action

Scan pull request changes for non-Baseline web platform features (features not yet in Web Platform Baseline) and surface:

- Compact PR comment summary (top findings grouped by advice)
- Optional HTML adoption report artifact
- Optional SARIF report for GitHub Code Scanning security alerts

The Action internally invokes the published CLI (`baseline-scan`) and shares logic with the `@whoisahmad/baseline-tools-core` analyzer.

## Usage

Reference a tagged release of this repository and the `packages/action` subdirectory. Prefer a version tag like `action-v0.0.1` or the moving major `action-v0`.

```yaml
name: Baseline Guard

on:
  pull_request: { types: [opened, synchronize, reopened] }
  workflow_dispatch: {}

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  baseline:
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
      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: baseline-report.sarif
```

## Inputs

| Name | Default | Description |
|------|---------|-------------|
| `github-token` | (none) | Token for PR comments and diff detection. Use `${{ secrets.GITHUB_TOKEN }}`. |
| `path` | `.` | Root path to scan. |
| `generate-html-report` | `true` | Generate an HTML adoption report. |
| `report-html-path` | `baseline-report.html` | Where to write the HTML report. |
| `generate-sarif-report` | `true` | Generate a SARIF 2.1.0 report. |
| `report-sarif-path` | `baseline-report.sarif` | Where to write the SARIF report. |

## Outputs

| Name | Description |
|------|-------------|
| `html-report` | Path to generated HTML report (if enabled). |
| `sarif-report` | Path to generated SARIF report (if enabled). |

## How it Works

1. Resolves targets (from `baseline.config.json` or nearest `browserslist`).
2. Runs `baseline-scan` (diff-only when a PR and token are provided) to identify non-Baseline features.
3. Posts a condensed PR comment (idempotent update). Guards (capability checks) downgrade severity.
4. Writes optional HTML / SARIF outputs for artifact and Code Scanning ingestion.

## Configuration

Create a `baseline.config.json` at the repository root (or nested) for consistent targets/thresholds:

```json
{
  "targets": ">0.5% and not dead",
  "unsupportedThreshold": 5,
  "ignore": ["**/dist/**"],
  "features": { "urlpattern": true }
}
```

## Local Testing

From this monorepo:

```bash
npm install
npm run build
node packages/cli/dist/index.js examples/demo-repo --report baseline-report.html --exit-zero
```

To dry-run the action in a workflow without publishing anything new, reuse the snippet above on a test branch.

## Versioning & Tags

The underlying packages are versioned with Changesets and published to npm. The Action itself is consumed via git tags (`action-vX.Y.Z`). A moving major tag (`action-v0`) points to the latest compatible release.

## License

MIT
