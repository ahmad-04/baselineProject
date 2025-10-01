# Baseline Guardrails for VS Code

Inline diagnostics and quick fixes for non‑Baseline web features, powered by a shared analyzer.

- Detects modern web APIs/selectors not yet in Baseline for your targets
- Hovers show advice, docs, and ~unsupported percentage
- Quick Fixes insert guard/fallback snippets
- Status bar shows totals, targets, and scan mode

## Commands

- Baseline: Scan Workspace
- Baseline: Toggle Scan Mode (change/save)
- Baseline: Pick Targets/Threshold
- Baseline: Fix all in file
- Baseline: Restart LSP (experimental)

## Settings

- baseline.scanOnChange (bool): scan on change vs only on save
- baseline.targets (string[]): Browserslist override
- baseline.unsupportedThreshold (number): <= threshold becomes "Safe"
- baseline.useLsp (bool): experimental stdio server, falls back automatically

## Notes

- Some fixes reference `@baseline-tools/helpers`. If your project is TS/JS and you want those helpers, install it:
  npm i -S @baseline-tools/helpers

For full docs, screenshots, and CLI/SARIF usage, see the repo README.
