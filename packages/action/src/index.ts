import * as core from "@actions/core";
import * as github from "@actions/github";
import { exec } from "node:child_process";
import { promisify } from "node:util";
const pexec = promisify(exec);

async function run() {
  try {
    const token = core.getInput("github-token", { required: false });
    const scanPath = core.getInput("path") || ".";
    core.info(`Running baseline-scan on: ${scanPath}`);

    const { stdout } = await pexec(
      `node ./packages/cli/dist/index.js ${scanPath} --json --exit-zero`
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
      if (f.suggestion) lines.push(`  - Fix: ${f.suggestion}`);
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
