// Demo code for scanner: one file that exercises many JS features
function demo() {
  // Baseline Yes example (should NOT warn): structuredClone
  const x = structuredClone({ a: 1 });
  console.log(x);

  // Guarded examples (should NOT warn): using feature detection
  if ((URL as any).canParse) {
    console.log("can parse URL", URL.canParse("https://example.com"));
  }
  if ((navigator as any).share) {
    navigator.share({ title: "Demo", url: location.href }).catch(() => {});
  }

  // Unguarded examples (should warn):
  // 1) URL.canParse
  console.log("Direct URL.canParse usage:", URL.canParse("https://test.com"));

  // 2) navigator.share (Web Share API)
  navigator.share({ title: "Unsafe Share" });

  // 3) Array.prototype.at
  const arr = [1, 2, 3];
  console.log("arr.at(-1) =", arr.at(-1));

  // 4) Promise.any
  Promise.any([Promise.reject("x"), Promise.resolve("first")]).then((v) =>
    console.log("Promise.any:", v)
  );

  // 5) URLPattern
  // @ts-ignore: URLPattern may be missing in TS lib target
  const p = new URLPattern({ pathname: "/users/:id" });
  console.log("URLPattern test:", p.test("https://site.com/users/123"));

  // 6) View Transitions API
  // @ts-ignore
  document.startViewTransition?.(() => {
    (document.getElementById("info") || document.body).textContent =
      "Transitioned";
  });
  // Also call without optional chaining to trigger detection
  // @ts-ignore
  document.startViewTransition(() => {});

  // 7) File System Access API: showOpenFilePicker
  // @ts-ignore
  window.showOpenFilePicker?.();
  // @ts-ignore
  window.showOpenFilePicker();

  // 8) Async Clipboard API
  navigator.clipboard?.writeText("hello");
  // @ts-ignore
  navigator.clipboard.writeText("world");
}

demo();
