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
    const status =
      f.baseline === "yes" ? pc.green("Baseline ✓") : pc.red("NOT Baseline");
    console.log(`- ${f.title} — ${status}`);
    console.log(`  • File: ${f.file}:${f.line}`);
    if (f.suggestion) console.log(`  • Suggest: ${f.suggestion}`);
    console.log(`  • Docs: ${f.docsUrl}`);
  }
  console.log(
    pc.bold(`\nTotals:`),
    `${nonBaseline.length} non-Baseline, ${findings.length - nonBaseline.length} safe`
  );
  return nonBaseline.length > 0 ? 1 : 0;
}

function parseArgs(argv: string[]) {
  const args = {
    path: ".",
    json: false,
    report: undefined as string | undefined,
    exitZero: false,
  };
  const rest: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--exit-zero") args.exitZero = true;
    else if (a === "--report") {
      args.report = argv[++i];
    } else if (!a.startsWith("-")) {
      rest.push(a);
    }
  }
  if (rest[0]) args.path = rest[0];
  return args;
}

async function main() {
  const argv = parseArgs(process.argv);
  const targetPath = argv.path ?? ".";
  const norm = targetPath.replace(/\\/g, "/");
  const patterns = [`${norm}/**/*.{js,jsx,ts,tsx,css,scss,html}`];
  const files = await globby(patterns, { gitignore: true, dot: false });
  const fileRefs: FileRef[] = [];
  for (const p of files) {
    const content = await fs.readFile(p, "utf8");
    fileRefs.push({ path: p, content });
  }
  const targets = await loadTargets(path.resolve(targetPath));
  const findings = analyze(fileRefs, { targets });
  const nonBaseline = findings.filter((f: any) => f.baseline !== "yes");
  const report = {
    meta: {
      targets: targets ?? null,
      filesScanned: files.length,
      generatedAt: new Date().toISOString(),
    },
    totals: {
      total: findings.length,
      nonBaseline: nonBaseline.length,
      safe: findings.length - nonBaseline.length,
    },
    findings,
  };
  if (argv.report) {
    await fs.writeFile(argv.report, JSON.stringify(report, null, 2), "utf8");
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
