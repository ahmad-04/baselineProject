export function canShare(): boolean {
  try {
    return typeof navigator !== "undefined" && !!(navigator as any).share;
  } catch {
    return false;
  }
}

export function canParseUrl(u = "https://example.com"): boolean {
  try {
    if (typeof (URL as any).canParse === "function")
      return (URL as any).canParse(u);
  } catch {
    // ignore
  }
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

export function hasViewTransitions(): boolean {
  try {
    return typeof document !== "undefined" && "startViewTransition" in document;
  } catch {
    return false;
  }
}

export function canShowOpenFilePicker(): boolean {
  try {
    return typeof (globalThis as any).showOpenFilePicker === "function";
  } catch {
    return false;
  }
}
