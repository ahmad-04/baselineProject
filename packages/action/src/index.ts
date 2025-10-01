import * as core from "@actions/core";
import * as github from "@actions/github";
import { exec } from "node:child_process";
import { promisify } from "node:util";
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

    const { stdout, stderr } = await pexec(
      `node ./packages/cli/dist/index.js ${scanPath} --json --exit-zero${filesArg}`
    );
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

    const lines: string[] = [];
    lines.push(
      `### Baseline Guard — ${nonBaseline.length} non-Baseline feature(s) detected`
    );
    if (report.meta?.targets) {
      lines.push(`Targets: ${(report.meta.targets as string[]).join(", ")}`);
    }
    for (const f of nonBaseline.slice(0, 20)) {
      lines.push(`\n- ${f.title} — ${f.file}:${f.line}`);
      if (f.suggestion) {
        lines.push(`  - Fix: ${f.suggestion}`);
        // add code block with a generic snippet based on featureId
        let snippet = "";
        if (f.featureId === "navigator-share") {
          snippet = `import { canShare } from '@baseline-tools/helpers';\n\nif (canShare()) {\n  await navigator.share({ title: document.title, url: location.href });\n} else {\n  // TODO: fallback\n}`;
        } else if (f.featureId === "url-canparse") {
          snippet = `import { canParseUrl } from '@baseline-tools/helpers';\n\nif (canParseUrl(myUrl)) {\n  // valid\n} else {\n  // fallback\n}`;
        } else if (f.featureId === "view-transitions") {
          snippet = `import { hasViewTransitions } from '@baseline-tools/helpers';\n\nif (hasViewTransitions()) {\n  // document.startViewTransition(() => { /* ... */ })\n} else {\n  // fallback\n}`;
        } else if (f.featureId === "file-system-access-picker") {
          snippet = `import { canShowOpenFilePicker } from '@baseline-tools/helpers';\n\nif (canShowOpenFilePicker()) {\n  // await showOpenFilePicker()\n} else {\n  // fallback: <input type=\"file\">\n}`;
        }
        if (snippet) {
          lines.push("  - Example:");
          lines.push("    \n``````\n".replace(/`/g, "`")); // ensure fence
          lines.push(snippet);
          lines.push("``````");
        }
      }
      if (f.docsUrl) lines.push(`  - Docs: ${f.docsUrl}`);
    }
    if (nonBaseline.length > 20) {
      lines.push(`\n…and ${nonBaseline.length - 20} more.`);
    }

    core.summary.addHeading("Baseline Guard");
    core.summary.addRaw(lines.join("\n"));
    if (generateHtml) {
      const cmd = `node ./packages/cli/dist/index.js ${scanPath} --exit-zero --report ${htmlReportPath}${filesArg}`;
      core.info(`Generating HTML report: ${htmlReportPath}`);
      await pexec(cmd);
      core.setOutput("html-report", htmlReportPath);
      core.summary.addRaw(`\n\nReport saved to: ${htmlReportPath}`);
      lines.push(`\nHTML report: ${htmlReportPath} (see workflow Artifacts)`);
    }
    await core.summary.write();

    if (token) {
      const octokit = github.getOctokit(token);
      const ctx = github.context;
      if (ctx.payload.pull_request) {
        await octokit.rest.issues.createComment({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          issue_number: ctx.payload.pull_request.number,
          body: lines.join("\n"),
        });
      }
    }
  } catch (err: any) {
    core.setFailed(err?.message || String(err));
  }
}

run();
