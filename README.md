# Baseline Guardrails

Shared Baseline engine + CLI + GitHub Action to help teams safely adopt modern web features.

- Core: `@baseline-tools/core` — analyzes code and maps to Baseline features.
- CLI: `baseline-scan` — scan a path and print findings.
- Action: `@baseline-tools/action` — PR bot that summarizes findings.

## Quick start

1. Install deps and build

```bash
npm install
npm run build
```

2. Try the CLI on the demo repo

```bash
npx baseline-scan examples/demo-repo
```

3. Explore the Action example workflow under `examples/demo-repo/.github/workflows/baseline.yml`.

## Packages

- `packages/core` — core analyze API.
- `packages/cli` — CLI wrapper.
- `packages/action` — GitHub Action (draft).

## Status

MVP scaffolding. Core analyzer is stubbed and will be expanded to curated features next.
