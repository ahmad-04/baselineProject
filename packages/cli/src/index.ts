#!/usr/bin/env node
import pc from "picocolors";
import { readPackageUp } from "read-pkg-up";
import { analyze, type FileRef } from "@baseline-tools/core";
import { globby } from "globby";
import fs from "node:fs/promises";
import path from "node:path";

async function loadTargets(cwd: string): Promise<string[] | undefined> {
  const pkg = await readPackageUp({ cwd });
  const browserslist = (pkg?.packageJson as any)?.browserslist;
  if (!browserslist) return undefined;
  if (Array.isArray(browserslist)) return browserslist as string[];
  if (typeof browserslist === "string") return [browserslist as string];
  if (typeof browserslist === "object" && browserslist.production)
    return browserslist.production as string[];
  return undefined;
}

function formatFindings(
  findings: ReturnType<typeof analyze>,
  targets?: string[] | undefined
) {
  if (findings.length === 0) {
    console.log(pc.green("No issues found."));
    return 0;
  }
  const nonBaseline = findings.filter((f: any) => f.baseline !== "yes");
  const header = targets?.length
    ? `Baseline scan summary (targets: ${targets.join(", ")})`
    : "Baseline scan summary";
  console.log(pc.bold(header));
  for (const f of findings) {
    const adv = (f as any).advice as string | undefined;
    const status =
      adv === "safe"
        ? pc.green("Safe to adopt")
        : adv === "guarded"
          ? pc.yellow("Guarded")
          : f.baseline === "yes"
            ? pc.green("Baseline ✓")
            : pc.red("Needs guard");
    console.log(`- ${f.title} — ${status}`);
    console.log(`  • File: ${f.file}:${f.line}`);
    if (f.suggestion) console.log(`  • Suggest: ${f.suggestion}`);
    console.log(`  • Docs: ${f.docsUrl}`);
  }
  const guardedCount = (findings as any[]).filter(
    (f) => f.advice === "guarded"
  ).length;
  const nonBaselineCount = nonBaseline.length - guardedCount;
  const safeCount = findings.length - nonBaseline.length + guardedCount;
  console.log(
    pc.bold(`\nTotals:`),
    `${nonBaselineCount} non-Baseline, ${safeCount} safe`
  );
  return nonBaseline.length > 0 ? 1 : 0;
}

function parseArgs(argv: string[]) {
  const args = {
    path: ".",
    json: false,
    report: undefined as string | undefined,
    exitZero: false,
    files: undefined as string[] | undefined,
  };
  const rest: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--exit-zero") args.exitZero = true;
    else if (a === "--report") {
      args.report = argv[++i];
    } else if (a === "--files") {
      const v = argv[++i];
      if (v)
        args.files = v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    } else if (!a.startsWith("-")) {
      rest.push(a);
    }
  }
  if (rest[0]) args.path = rest[0];
  return args;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtmlReport(report: any): string {
  const targets = report?.meta?.targets as string[] | null;
  const findings = (report?.findings as any[]) ?? [];
  const rows = findings
    .map((f) => {
      const advice = (
        f.advice === "guarded"
          ? "Guarded"
          : f.advice === "safe"
            ? "Safe to adopt"
            : "Needs guard"
      ) as string;
      return `<tr>
  <td>${escapeHtml(f.title)}</td>
  <td><code>${escapeHtml(f.file)}:${f.line}</code></td>
  <td>${escapeHtml(advice)}</td>
  <td>${escapeHtml(f.suggestion || "")}</td>
  <td><a href="${escapeHtml(f.docsUrl)}" target="_blank" rel="noreferrer noopener">Docs</a></td>
</tr>`;
    })
    .join("\n");
  const totals = report?.totals ?? {};
  const generatedAt = report?.meta?.generatedAt;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Baseline Adoption Report</title>
  <style>
    :root { --fg:#0b0d12; --muted:#5a6372; --ok:#0a7f3f; --warn:#b88300; --err:#b11; --bg:#fff; --line:#e8ecf2; }
    body { font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji; margin: 24px; color: var(--fg); background: var(--bg); }
    header { margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 6px; }
    .meta { color: var(--muted); font-size: 12px; }
    .totals { margin: 12px 0 20px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 8px; vertical-align: top; }
    thead th { border-bottom: 2px solid var(--line); font-size: 12px; color: var(--muted); }
    tbody tr { border-bottom: 1px solid var(--line); }
    code { background: #f6f8fa; border: 1px solid #eaeef2; padding: 1px 4px; border-radius: 3px; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge.safe { background: #e8f7ee; color: var(--ok); border: 1px solid #c7ecd6; }
    .badge.needs { background: #fff7e5; color: var(--warn); border: 1px solid #ffe7a6; }
    .badge.guarded { background: #eef4ff; color: #2b5fd9; border: 1px solid #d8e3ff; }
  </style>
  </head>
<body>
  <header>
    <h1>Baseline Adoption Report</h1>
    <div class="meta">
      ${targets && targets.length ? `Targets: ${targets.map(escapeHtml).join(", ")}` : "Targets: (none)"}
      ${generatedAt ? ` • Generated: ${escapeHtml(generatedAt)}` : ""}
    </div>
    <div class="totals">
      Total findings: ${Number(totals.total) ?? 0} • Non-Baseline: ${Number(totals.nonBaseline) ?? 0} • Safe: ${Number(totals.safe) ?? 0}
    </div>
  </header>
  <main>
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Location</th>
          <th>Advice</th>
          <th>Suggestion</th>
          <th>Docs</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </main>
</body>
</html>`;
}

async function main() {
  const argv = parseArgs(process.argv);
  const targetPath = argv.path ?? ".";
  const norm = targetPath.replace(/\\/g, "/");
  let files: string[];
  if (argv.files && argv.files.length > 0) {
    files = await globby(argv.files, {
      gitignore: true,
      dot: false,
      expandDirectories: false,
    });
  } else {
    const patterns = [`${norm}/**/*.{js,jsx,ts,tsx,css,scss,html}`];
    files = await globby(patterns, { gitignore: true, dot: false });
  }
  const fileRefs: FileRef[] = [];
  for (const p of files) {
    const content = await fs.readFile(p, "utf8");
    fileRefs.push({ path: p, content });
  }
  const targets = await loadTargets(path.resolve(targetPath));
  const findings = analyze(fileRefs, { targets });
  const nonBaseline = findings.filter((f: any) => f.baseline !== "yes");
  const guardedCount = (findings as any[]).filter(
    (f) => (f as any).advice === "guarded"
  ).length;
  const report = {
    meta: {
      targets: targets ?? null,
      filesScanned: files.length,
      generatedAt: new Date().toISOString(),
    },
    totals: {
      total: findings.length,
      nonBaseline: nonBaseline.length - guardedCount,
      safe: findings.length - nonBaseline.length + guardedCount,
    },
    findings,
  };
  if (argv.report) {
    const ext = path.extname(argv.report || "").toLowerCase();
    if (ext === ".html" || ext === ".htm") {
      const html = renderHtmlReport(report);
      await fs.writeFile(argv.report, html, "utf8");
    } else {
      await fs.writeFile(argv.report, JSON.stringify(report, null, 2), "utf8");
    }
  }
  if (argv.json) {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = argv.exitZero ? 0 : nonBaseline.length > 0 ? 1 : 0;
    return;
  }
  const code = formatFindings(findings, targets);
  process.exitCode = argv.exitZero ? 0 : code;
}

main().catch((err) => {
  console.error(pc.red(String(err?.stack || err)));
  process.exitCode = 1;
});
