import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../dist/index.js";

function file(path, content) {
  return { path, content };
}

test("async clipboard detection with guard is 'guarded'", () => {
  const src = `if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText('x'); }`;
  const res = analyze([file("a.ts", src)]);
  const f = res.find((x) => x.featureId === "async-clipboard");
  assert.ok(f, "expected async-clipboard finding");
  assert.equal(f.advice, "guarded");
});

test("import maps detected in HTML", () => {
  const html = `<script type="importmap">{}</script>`;
  const res = analyze([file("a.html", html)]);
  const f = res.find((x) => x.featureId === "import-maps");
  assert.ok(f, "expected import-maps finding");
});
