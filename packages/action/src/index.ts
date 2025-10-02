import * as core from "@actions/core";
import * as github from "@actions/github";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
const pexec = promisify(exec);

async function run() {
  try {
    const token = core.getInput("github-token", { required: false });
    const scanPath = core.getInput("path") || ".";
    const generateHtml =
      (core.getInput("generate-html-report") || "false").toLowerCase() !==
      "false";
    const htmlReportPath =
      core.getInput("report-html-path") || "baseline-report.html";
    const generateSarif =
      (core.getInput("generate-sarif-report") || "false").toLowerCase() !==
      "false";
    const sarifReportPath =
      core.getInput("report-sarif-path") || "baseline-report.sarif";
    core.info(`Preparing Baseline scan on: ${scanPath}`);

    // Compute changed files for PRs and filter to our target path and extensions
    const ctx = github.context;
    let filesArg = "";
    const allowed = [
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".css",
      ".scss",
      ".sass",
      ".html",
      ".htm",
    ];
    if (token && ctx.payload.pull_request) {
      const octokit = github.getOctokit(token);
      const { owner, repo } = ctx.repo;
      const prNumber = ctx.payload.pull_request.number;
      const changed: string[] = [];
      let page = 1;
      while (true) {
        const { data } = await octokit.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: prNumber,
          per_page: 100,
          page,
        });
        if (!data.length) break;
        for (const f of data) changed.push(f.filename);
        if (data.length < 100) break;
        page++;
      }
      const filtered = changed
        .filter((p) => p.startsWith(scanPath.replace(/\\/g, "/")))
        .filter((p) => allowed.some((ext) => p.endsWith(ext)));
      // Cap number of files to avoid huge CLI arg strings; fall back to full scan
      if (filtered.length > 0 && filtered.length <= 200) {
        // comma-separated list; quote is added around whole string in command
        filesArg = ` --files "${filtered.join(",")}"`;
        core.info(`Diff-only mode with ${filtered.length} file(s).`);
      } else {
        core.info(
          filtered.length === 0
            ? "No relevant changed files detected; scanning full path."
            : `Too many changed files (${filtered.length}); scanning full path instead.`
        );
      }
    }

    let stdout: string;
    let stderr: string;
    try {
      ({ stdout, stderr } = await pexec(
        `npx -y @whoisahmad/baseline-tools-cli ${scanPath} --json --exit-zero${filesArg}`
      ));
    } catch {
      const localCli = path.resolve(__dirname, "../../cli/dist/index.js");
      ({ stdout, stderr } = await pexec(
        `${process.execPath} ${localCli} ${scanPath} --json --exit-zero${filesArg}`
      ));
    }
    let report: any;
    try {
      report = JSON.parse(stdout);
    } catch (e) {
      core.warning(
        `Failed to parse CLI JSON output. stdout length=${stdout?.length}; stderr length=${stderr?.length}`
      );
      throw e;
    }
    const findings: any[] = report.findings || [];
    const nonBaseline = findings.filter((f) => f.baseline !== "yes");
    const safeCount = findings.filter((f) => f.advice === "safe").length;
    const guardedCount = findings.filter((f) => f.advice === "guarded").length;
    const needsGuardCount = findings.filter(
      (f) => f.advice === "needs-guard"
    ).length;

    // Build a compact table (top 10 issues, prioritize needs-guard)
    const TOP_N = 10;
    const baseDir = path.resolve(scanPath);
    const top = [...nonBaseline]
      .sort((a, b) => {
        const order = (x: any) =>
          x.advice === "needs-guard" ? 0 : x.advice === "guarded" ? 1 : 2;
        return order(a) - order(b);
      })
      .slice(0, TOP_N);

    const tableHeader = [
      "| Feature | Location | Advice | ~Unsupported | Docs |",
      "|---|---|---:|---:|---|",
    ];
    const tableRows = top.map((f) => {
      const rel = (() => {
        try {
          const r = path.relative(baseDir, f.file || "");
          return r && !r.startsWith("..")
            ? r
            : path.relative(process.cwd(), f.file || "");
        } catch {
          return f.file || "";
        }
      })().replace(/\\\\/g, "/");
      const advice =
        f.advice === "guarded"
          ? "guarded"
          : f.advice === "safe"
            ? "safe"
            : "needs-guard";
      const unsupported =
        typeof f.unsupportedPercent === "number"
          ? `${f.unsupportedPercent}%`
          : "";
      const docs = f.docsUrl ? `[link](${f.docsUrl})` : "";
      return `| ${escapeMd(f.title)} | ${escapeMd(rel)}:${f.line} | ${advice} | ${unsupported} | ${docs} |`;
    });

    const summaryLines: string[] = [];
    summaryLines.push(
      `**Baseline Guard** — ${nonBaseline.length} non-Baseline`
    );
    if (report.meta?.targets)
      summaryLines.push(
        `Targets: ${(report.meta.targets as string[]).join(", ")}`
      );
    summaryLines.push(
      `Totals — safe: ${safeCount}, guarded: ${guardedCount}, needs-guard: ${needsGuardCount}`
    );
    if (report.meta?.filesScanned != null)
      summaryLines.push(`Files scanned: ${report.meta.filesScanned}`);
    summaryLines.push("");
    summaryLines.push(...tableHeader, ...tableRows);
    if (nonBaseline.length > TOP_N) {
      const moreMsg = generateHtml
        ? `\n…plus ${nonBaseline.length - TOP_N} more. See HTML report for full details.`
        : `\n…plus ${nonBaseline.length - TOP_N} more. Consider enabling the HTML report for full details.`;
      summaryLines.push(moreMsg);
    }

    core.summary.addHeading("Baseline Guard");
    core.summary.addRaw(summaryLines.join("\n"));
    if (generateHtml) {
      core.info(`Generating HTML report: ${htmlReportPath}`);
      try {
        const cmd = `npx -y @whoisahmad/baseline-tools-cli ${scanPath} --exit-zero --report ${htmlReportPath}${filesArg}`;
        await pexec(cmd);
      } catch {
        const localCli = path.resolve(__dirname, "../../cli/dist/index.js");
        const cmd = `${process.execPath} ${localCli} ${scanPath} --exit-zero --report ${htmlReportPath}${filesArg}`;
        await pexec(cmd);
      }
      core.setOutput("html-report", htmlReportPath);
      core.summary.addRaw(`\n\nReport saved to: ${htmlReportPath}`);
      summaryLines.push(
        `\nHTML report: ${htmlReportPath} (see workflow Artifacts)`
      );
    }
    if (generateSarif) {
      core.info(`Generating SARIF report: ${sarifReportPath}`);
      try {
        const cmdSarif = `npx -y @whoisahmad/baseline-tools-cli ${scanPath} --exit-zero --report ${sarifReportPath}${filesArg}`;
        await pexec(cmdSarif);
      } catch {
        const localCli = path.resolve(__dirname, "../../cli/dist/index.js");
        const cmdSarif = `${process.execPath} ${localCli} ${scanPath} --exit-zero --report ${sarifReportPath}${filesArg}`;
        await pexec(cmdSarif);
      }
      core.setOutput("sarif-report", sarifReportPath);
    }
    await core.summary.write();

    if (token) {
      const octokit = github.getOctokit(token);
      const ctx = github.context;
      if (ctx.payload.pull_request) {
        const commentBody = summaryLines.join("\n");
        await octokit.rest.issues.createComment({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          issue_number: ctx.payload.pull_request.number,
          body: commentBody,
        });
      }
    }
  } catch (err: any) {
    core.setFailed(err?.message || String(err));
  }
}

run();

// Minimal markdown escaper for table cells
function escapeMd(s: string): string {
  return String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();
}
