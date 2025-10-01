# Releasing

This repo uses Changesets to manage versioning and publishing for npm packages, and a separate workflow to package the VS Code extension.

## Prerequisites

- Node.js >= 18.18
- npm registry auth: set `NPM_TOKEN` secret in the GitHub repo for automated publishes
- Optional: VS Code Marketplace publisher set up if you plan to publish there

## Versioning and Publishing (Changesets)

1. Create or update changesets locally:

```bash
npx changeset
```

2. On push to `main`, the `Release Packages` workflow will either:

- Open/refresh a Release PR with bumped versions (if changesets exist), or
- Publish immediately when the Release PR is merged

3. You can also trigger the workflow manually with an input to skip the release PR and publish directly:

- Manual dispatch input `create_pr` (default `true`): when set to `false`, the workflow versions, commits, pushes to `main`, and publishes without opening a PR.
- For the default PR path, ensure your org/repo allows the Actions bot to create PRs, or configure a Personal Access Token (PAT) like `CHANGESETS_TOKEN` and use that in the Changesets step.

4. The workflow calls these scripts:

- `npm run release:version`: applies version bumps and updates lockfile
- `npm run release:publish`: publishes public packages to npm

Ensure `NPM_TOKEN` is available to the workflow. Packages published:

- `@baseline-tools/core`
- `@baseline-tools/cli`
- `eslint-plugin-baseline`

Helpers and other internal packages can be added as needed.

## VS Code Extension Packaging

The extension is built and packaged as a `.vsix` via the `Package VS Code Extension` workflow when a tag matching `v*` is pushed, or manually via workflow dispatch.

- Artifact: `baseline-guardrails-vscode.vsix` at repo root
- Local packaging command:

```bash
npm run vsce:package
```

This runs `vsce package` inside `packages/vscode-extension` with `--no-dependencies` and outputs the `.vsix` two directories up.

To publish to the Marketplace, use `vsce publish` with your publisher name configured, or upload the `.vsix` manually in a release.

## SARIF and HTML Reports in CI

- `baseline-guard.yml` uploads SARIF for Code Scanning and HTML reports as artifacts
- `scan-changed` job scans only changed files using `--changed` + cache

## Tips

- Verify build/tests locally before pushing:

```bash
npm run build
npm run test
```

- Use `--exit-zero` with reports in CI to avoid failing builds on findings
- Keep `baseline.config.json` consistent across tools; VS Code settings can override when needed
