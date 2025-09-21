import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("CLI produces SARIF file with rules and results", () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname, "../../..");
  const cli = path.join(root, "packages", "cli", "dist", "index.js");
  const demo = path.join(root, "examples", "demo-repo");
  const out = path.join(root, "baseline-report.sarif");
  execFileSync(process.execPath, [cli, demo, "--report", out, "--exit-zero"], {
    stdio: "inherit",
  });
  const sarif = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(sarif.version, "2.1.0");
  assert.ok(Array.isArray(sarif.runs[0].tool.driver.rules));
  assert.ok(Array.isArray(sarif.runs[0].results));
});
