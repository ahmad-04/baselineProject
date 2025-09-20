#!/usr/bin/env node
import pc from "picocolors";
import { readPackageUp } from "read-pkg-up";
import { analyze, type FileRef } from "@baseline-tools/core";
import { globby } from "globby";
import fs from "node:fs/promises";
import path from "node:path";

async function loadTargets(): Promise<string[] | undefined> {
  const pkg = await readPackageUp({ cwd: process.cwd() });
  const browserslist = (pkg?.packageJson as any)?.browserslist;
  if (!browserslist) return undefined;
  if (Array.isArray(browserslist)) return browserslist as string[];
  if (typeof browserslist === "string") return [browserslist as string];
  if (typeof browserslist === "object" && browserslist.production)
    return browserslist.production as string[];
  return undefined;
}

function formatFindings(findings: ReturnType<typeof analyze>) {
  if (findings.length === 0) {
    console.log(pc.green("No issues found."));
    return 0;
  }
  const nonBaseline = findings.filter((f) => f.baseline !== "yes");
  console.log(pc.bold(`Baseline scan summary`));
  for (const f of findings) {
    const status =
      f.baseline === "yes" ? pc.green("Baseline ✓") : pc.red("NOT Baseline");
    console.log(`- ${f.title} — ${status}`);
    console.log(`  • File: ${f.file}:${f.line}`);
    if (f.suggestion) console.log(`  • Suggest: ${f.suggestion}`);
    console.log(`  • Docs: ${f.docsUrl}`);
  }
  return nonBaseline.length > 0 ? 1 : 0;
}

async function main() {
  const targetPath = process.argv[2] ?? ".";
  const patterns = [
    path.join(targetPath, "**/*.{js,jsx,ts,tsx,css,scss,html}"),
  ];
  const files = await globby(patterns, { gitignore: true, dot: false });
  const fileRefs: FileRef[] = [];
  for (const p of files) {
    const content = await fs.readFile(p, "utf8");
    fileRefs.push({ path: p, content });
  }
  const targets = await loadTargets();
  const findings = analyze(fileRefs, { targets });
  const code = formatFindings(findings);
  process.exitCode = code;
}

main().catch((err) => {
  console.error(pc.red(String(err?.stack || err)));
  process.exitCode = 1;
});
