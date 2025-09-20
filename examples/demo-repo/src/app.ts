// Demo code for scanner
function demo() {
  // Intentional: reference structuredClone (Baseline yes for many targets)
  const x = structuredClone({ a: 1 });
  console.log(x);

  // Intentional: potential non-Baseline features
  if ((URL as any).canParse) {
    console.log("can parse URL", URL.canParse("https://example.com"));
  }
  if ((navigator as any).share) {
    navigator.share({ title: "Demo", url: location.href }).catch(() => {});
  }
}

demo();
