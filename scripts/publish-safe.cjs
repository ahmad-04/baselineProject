#!/usr/bin/env node
/*
 Idempotent publish wrapper around `changeset publish`.
 - Runs `changeset publish`.
 - Detects E403/E409 attempts to republish an identical version and downgrades them to success.
 - Provides a concise summary at the end.
*/

const { spawn } = require("node:child_process");

const child = spawn("npx", ["changeset", "publish"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (d) => {
  process.stdout.write(d);
  stdout += d.toString();
});
child.stderr.on("data", (d) => {
  process.stderr.write(d);
  stderr += d.toString();
});

child.on("close", (code) => {
  // Known harmless errors when attempting to publish an already published version.
  const alreadyPublished =
    /(cannot publish over the previously published versions|You cannot publish over the previously published versions)/i;
  if (code !== 0) {
    if (alreadyPublished.test(stdout) || alreadyPublished.test(stderr)) {
      console.log(
        "\n[publish-safe] Detected attempts to republish existing versions. Treating as success."
      );
      process.exit(0);
      return;
    }
  }
  console.log("\n[publish-safe] Exit code: " + code);
  process.exit(code);
});
