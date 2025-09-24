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

  // Direct usage of URL.canParse without feature detection (should trigger warning)
  console.log("Direct URL.canParse usage:", URL.canParse("https://test.com"));

  // Direct usage of navigator.share without feature detection (should trigger warning)
  navigator.share({ title: "Unsafe Share" });
}

demo();
