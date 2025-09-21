import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../dist/index.js";

function file(path, content) {
  return { path, content };
}

test("guards: navigator.share is recognized as guarded", () => {
  const src = `if (navigator.share) { await navigator.share({ title: 'x' }); }`;
  const res = analyze([file("a.ts", src)]);
  const share = res.find((f) => f.featureId === "navigator-share");
  assert.ok(share, "expected share finding");
  assert.equal(share.advice, "guarded");
});

test("targets: unsupportedPercent is attached when targets provided", () => {
  const src = `document.startViewTransition(()=>{});`;
  const res = analyze([file("b.ts", src)], { targets: [">0.5% and not dead"] });
  const vt = res.find((f) => f.featureId === "view-transitions");
  assert.ok(vt, "expected view transitions finding");
  assert.equal(typeof vt.unsupportedPercent, "number");
});
