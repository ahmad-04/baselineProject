import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../dist/index.js";

function file(path, content) {
  return { path, content };
}

test("lazy-loading attribute detected on img and iframe", () => {
  const html = `
    <img src="a.jpg" loading="lazy">
    <iframe src="/x" loading='lazy'></iframe>
  `;
  const res = analyze([file("a.html", html)]);
  assert.ok(
    res.find((x) => x.featureId === "loading-lazy-attr"),
    "expected loading-lazy-attr finding"
  );
});

test("text-wrap: balance detected in CSS", () => {
  const css = `h1{ text-wrap: balance } section{ text-wrap:   balance; }`;
  const res = analyze([file("a.css", css)]);
  assert.ok(
    res.find((x) => x.featureId === "css-text-wrap-balance"),
    "expected css-text-wrap-balance finding"
  );
});
