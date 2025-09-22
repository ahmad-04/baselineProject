import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../dist/index.js";

function file(path, content) {
  return { path, content };
}

test("<dialog> element detected in HTML", () => {
  const html = `<dialog open>Hi</dialog>`;
  const res = analyze([file("a.html", html)]);
  assert.ok(
    res.find((x) => x.featureId === "html-dialog"),
    "expected html-dialog finding"
  );
});

test("URLPattern alias constructor variant detected", () => {
  const js = `const P = URLPattern; const p = new P('https://example.com/:id');`;
  const res = analyze([file("a.js", js)]);
  assert.ok(
    res.find((x) => x.featureId === "urlpattern"),
    "expected urlpattern finding"
  );
});
