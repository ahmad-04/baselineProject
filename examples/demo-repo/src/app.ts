// Demo code for scanner
function demo() {
  // Intentional: reference structuredClone (Baseline yes for many targets)
  const x = structuredClone({ a: 1 });
  console.log(x);
}

demo();
