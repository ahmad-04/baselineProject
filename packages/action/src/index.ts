import * as core from "@actions/core";
import * as github from "@actions/github";

async function run() {
  try {
    const token = core.getInput("github-token", { required: false });
    const path = core.getInput("path") || ".";

    // For MVP, call CLI and capture output using shell redirection within workflow step.
    // A more robust approach would import the core analyzer and diff-only scan.
    core.info(`Scanning path: ${path}`);
    // Placeholder: rely on workflow to run CLI; just write to summary.
    core.summary.addHeading("Baseline Guard — Summary");
    core.summary.addRaw(
      "Run baseline-scan in a previous step and attach output here."
    );
    await core.summary.write();

    if (token) {
      const octokit = github.getOctokit(token);
      const ctx = github.context;
      if (ctx.payload.pull_request) {
        await octokit.rest.issues.createComment({
          owner: ctx.repo.owner,
          repo: ctx.repo.repo,
          issue_number: ctx.payload.pull_request.number,
          body: "Baseline Guard ran. See job summary for details.",
        });
      }
    }
  } catch (err: any) {
    core.setFailed(err?.message || String(err));
  }
}

run();
