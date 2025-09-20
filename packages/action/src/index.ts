import * as core from "@actions/core";
import * as github from "@actions/github";
import { exec } from "node:child_process";
import { promisify } from "node:util";
const pexec = promisify(exec);

async function run() {
  try {
    const token = core.getInput("github-token", { required: false });
    const scanPath = core.getInput("path") || ".";
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
      if (filtered.length > 0) {
        // comma-separated list; quote is added around whole string in command
        filesArg = ` --files "${filtered.join(",")}"`;
        core.info(`Diff-only mode with ${filtered.length} file(s).`);
      } else {
        core.info("No relevant changed files detected; scanning full path.");
      }
    }

    const { stdout } = await pexec(
      `node ./packages/cli/dist/index.js ${scanPath} --json --exit-zero${filesArg}`
    );
    const report = JSON.parse(stdout);
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
          snippet = `if (navigator.share) {\n  await navigator.share({ title: document.title, url: location.href });\n} else {\n  // TODO: fallback\n}`;
        } else if (f.featureId === "url-canparse") {
          snippet = `function canParse(u){ try { new URL(u); return true; } catch { return false; } }`;
        } else if (f.featureId === "view-transitions") {
          snippet = `if ('startViewTransition' in document) {\n  // document.startViewTransition(() => { ... })\n} else {\n  // fallback\n}`;
        } else if (f.featureId === "file-system-access-picker") {
          snippet = `// Fallback: <input type=\"file\"> for older browsers\nconst input = document.createElement('input');\ninput.type = 'file';\ninput.click();`;
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
