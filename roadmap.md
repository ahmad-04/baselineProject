# Baseline Guardrails — Roadmap

This roadmap guides delivery of the MVP and competitive stretch goals within 15–16 days. It is optimized for hackathon judging: innovation, usefulness, and demo polish.

## Vision

Enable teams to adopt modern web features safely by integrating Baseline data directly into development workflows (CLI, PR reviews, editor), providing clear guidance, progressive enhancement patterns, and measurable impact.

## Outcomes (Success Criteria)

- Accuracy: ≤ 5% false positives on curated features.
- Performance: Scan 50k LOC < 10s locally; PR scan < 30s.
- DevEx: Zero-config when `browserslist` exists; optional `baseline.config.json`.
- Demoable: README, tests, sample repo with PRs, 3–5 min video, permissive license (MIT).

## Scope (MVP)

- Core engine (`@baseline-tools/core`): Map code tokens (JS/CSS/HTML) to Baseline features using `web-features`, evaluate against project `browserslist`, return docs + remediation.
- CLI (`baseline-scan`): `npx baseline-scan <path>` scans repo, prints findings (pretty + JSON), exit code on violations.
- GitHub Action (PR bot): Scans changed files, posts structured comment with severity and fix suggestions; optional SARIF upload.

## Feature Set (Curated v1)

- JS: `structuredClone`, `Array.prototype.at`, `Promise.any`, `URLPattern`, `AbortController`, `Intl.Segmenter`, View Transitions API, File System Access API, Web Share API.
- CSS: `:has()`, nesting, `@container`, `@layer`, `oklch/oklab` color(), `:focus-visible`, subgrid (informational), `:where()` (safe modernization hints).
- HTML: `popover` attribute, `input` types and `showPicker` (where applicable).

## Deliverables

- Packages (monorepo):
  - `packages/core`: Baseline resolution engine.
  - `packages/cli`: `baseline-scan` CLI.
  - `packages/action`: GitHub Action wrapper.
  - `examples/demo-repo`: Sample project + workflows.
- Docs: README per package, top-level overview, demo script, troubleshooting.
- Tests: Unit tests (mapping, parsers), CLI integration tests on fixture projects.

## Milestones & Timeline

- Days 1–2: Foundation
  - Monorepo scaffolding (TypeScript, workspaces, lint/test, MIT license).
  - Define curated feature map; pin `web-features` version; write success metrics.
- Days 3–5: Core Engine
  - Load and normalize `web-features`; browserslist integration; feature resolution API.
  - Implement token mappers: JS (Babel/TypeScript AST), CSS (PostCSS), HTML (parse5).
  - Tests for feature detection and Baseline evaluation.
- Days 6–8: CLI MVP
  - Implement scanning over file globs; respect `.gitignore`.
  - Output: table + JSON; exit codes; perf pass; config file support.
  - Add curated remediation texts with MDN/Web Platform links.
- Days 9–10: GitHub Action
  - Diff-only scanning; PR comment formatting (severity, files, lines, suggestions).
  - Example workflow; optional SARIF; demo repo wired.
- Days 11–12: QA & Polish
  - Reduce false positives; cache + incremental scans; stable messaging.
  - Add Baseline Coverage metric and README badge (from JSON output).
- Days 13–14: Docs & Demo
  - End-to-end README, quickstart, configuration, troubleshooting.
  - Record 3–5 min demo; finalize screenshots and PR examples.
- Days 15–16: Buffer & Stretch
  - Resolve issues; performance profiling; packaging; publish pre-releases.
  - Stretch goals (see below).

## Stretch Goals (Pick 2–3)

- Vite/webpack plugin: Baseline coverage and potential polyfill savings.
- Progressive Enhancement snippets: Ready-to-paste guard patterns per feature.
- Forecast: “Expected Baseline by Qx YYYY” annotations in outputs.
- SARIF output: Integrate with GitHub Code Scanning for rich findings UI.

## Architecture Overview

- Core provides a pure function:

  ```ts
  type Finding = {
    file: string;
    line: number;
    column: number;
    featureId: string;
    title: string;
    baseline: "yes" | "no" | "partial";
    severity: "info" | "warn" | "error";
    docsUrl: string;
    dashboardUrl?: string;
    suggestion?: string;
  };

  function analyze(
    files: Iterable<FileRef>,
    options: { targets?: string[]; featureSet?: "curated" | "all" }
  ): Finding[];
  ```

- CLI and Action are thin wrappers around `analyze()`. Action adds diff-awareness and PR comment formatting.

## Config

- Sources: `browserslist` (package.json or config files).
- Optional: `baseline.config.json` with overrides:
  - `targets`, `severityOverrides`, `include`, `exclude`, `output: { json, sarif }`.

## Risks & Mitigations

- Mapping ambiguity → Start curated, mark uncertain as `info`, add tests.
- Parser complexity → Support JS/TS/JSX + CSS + HTML first; add frameworks later.
- Performance → Cache per file hash; stream outputs; limit work to diffs in CI.
- Data drift → Pin `web-features` version; display “Data last updated”.

## Demo Script (3–5 min)

1. Run CLI on demo repo: shows safe and unsafe features with suggestions.
2. Open PR adding `:has()` and View Transitions: PR bot comments with guidance.
3. Show Baseline coverage metric and generated README badge.
4. Optional: Drop an old polyfill after confirming feature is Baseline.

## Metrics & Telemetry (optional opt-in)

- Aggregate anonymized counts of flagged features and runtime (local only, opt-in) to report impact in the presentation.

## License & Governance

- MIT license; CONTRIBUTING.md; CODE_OF_CONDUCT.md. Clear versioning and changelog.

## Post-Hackathon Path

- Expand feature coverage; VS Code extension; Stylelint rule; Vite plugin; website with live scanner.
