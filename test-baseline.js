// Baseline test file
// This file has some features that should trigger Baseline diagnostics

// URL.canParse() - should be detected and marked
if (URL.canParse("https://example.com")) {
  console.log("Valid URL");
}

// navigator.share - should be detected and marked
async function shareContent() {
  if (navigator.share) {
    await navigator.share({
      title: "Test",
      url: "https://example.com",
    });
  }
}

// structuredClone - should be detected
const obj = { a: 1, b: { c: 2 } };
const clone = structuredClone(obj);

// This is to test if the extension is correctly scanning the file
// and showing diagnostics for these non-baseline features
