# Incremental Scanning

This project supports incremental scans via two mechanisms:

- CLI cache v3: per-file content hash cache keyed by targets and config hash
- Git-aware diff scanning: `--changed` and `--since <ref>`

## Cache (v3)

- When `--cache` is passed, the CLI creates/updates `.baseline-scan-cache.json`.
- Each file entry stores its last content hash and findings.
- On subsequent runs, if the hash, targets, and config hash match, findings are reused without re-parsing.
- Cache invalidates automatically when config changes (hash mismatch) or targets change.

Tip: Customize cache file path with `--cache-file <path>`.

## Diff-only scanning

- `--changed`: Restrict scan to files changed since `HEAD` (or another ref when combined with `--since`).
- `--since <ref>`: Overrides the base ref for the diff (e.g., `origin/main`, a branch, or a commit SHA).
- Untracked files are included.

No changes case: If no files are changed, the CLI prints a message and exits 0. If `--report` is specified, an empty report is written in the requested format.

## Examples

```bash
# Only changed files vs HEAD, write HTML, do not fail CI
node packages/cli/dist/index.js --changed --cache --report baseline-report.html --exit-zero

# Only files changed since origin/main, produce SARIF
node packages/cli/dist/index.js --changed --since origin/main --cache --report baseline-report.sarif --exit-zero

# Full scan with cache
node packages/cli/dist/index.js . --cache --report baseline-report.json --exit-zero
```
