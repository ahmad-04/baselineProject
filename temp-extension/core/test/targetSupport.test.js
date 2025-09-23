import assert from "node:assert/strict";
import test from "node:test";
import { getSupport } from "../dist/targetSupport.js";

test("getSupport returns a number for css-has", () => {
  const pct = getSupport("css-has", [">0.5% and not dead"]);
  assert.equal(typeof pct, "number");
  assert.ok(pct >= 0 && pct <= 100);
});

test("getSupport returns a number for navigator-share", () => {
  const pct = getSupport("navigator-share", [">0.5% and not dead"]);
  assert.equal(typeof pct, "number");
  assert.ok(pct >= 0 && pct <= 100);
});

test("getSupport (mdn) returns a number for container queries", () => {
  const pct = getSupport("css-container-queries", [">0.5% and not dead"]);
  assert.equal(typeof pct, "number");
  assert.ok(pct >= 0 && pct <= 100);
});
