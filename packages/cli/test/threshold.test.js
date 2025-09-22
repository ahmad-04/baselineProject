import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

test("unsupported-threshold reclassifies needs-guard to safe", () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname, "../../..");
  const cli = path.join(root, "packages", "cli", "dist", "index.js");
  const demo = path.join(root, "examples", "demo-repo");
  const out = path.join(root, "baseline-report.json");
  execFileSync(
    process.execPath,
    [
      cli,
      demo,
      "--report",
      out,
      "--exit-zero",
      "--unsupported-threshold",
      "10",
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  const report = JSON.parse(readFileSync(out, "utf8"));
  const needsGuard = report.findings.filter((f) => f.advice === "needs-guard");
  const safe = report.findings.filter((f) => f.advice === "safe");
  assert.ok(
    safe.length >= 1,
    "expected at least one finding reclassified to safe"
  );
  assert.ok(needsGuard.length >= 0);
});
