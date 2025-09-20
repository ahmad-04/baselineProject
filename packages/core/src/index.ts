export type BaselineStatus = "yes" | "no" | "partial";
export type Severity = "info" | "warn" | "error";

export interface Finding {
  file: string;
  line: number;
  column: number;
  featureId: string;
  title: string;
  baseline: BaselineStatus;
  severity: Severity;
  docsUrl: string;
  dashboardUrl?: string;
  suggestion?: string;
}

export interface AnalyzeOptions {
  targets?: string[];
  featureSet?: "curated" | "all";
}

export interface FileRef {
  path: string;
  content: string;
}

const JS_FEATURES = [
  {
    id: "structured-clone",
    title: "structuredClone()",
    regex: /\bstructuredClone\s*\(/g,
    docs: "https://developer.mozilla.org/docs/Web/API/structuredClone",
    baseline: "yes" as BaselineStatus,
    suggestion:
      "Prefer structuredClone over deep-clone utilities; guard if targeting older browsers.",
  },
  {
    id: "array-prototype-at",
    title: "Array.prototype.at()",
    regex: /\.at\s*\(/g,
    docs: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/at",
    baseline: "partial" as BaselineStatus,
    suggestion:
      "Fallback: use arr[index >= 0 ? index : arr.length + index] for negatives.",
  },
  {
    id: "promise-any",
    title: "Promise.any()",
    regex: /Promise\.any\s*\(/g,
    docs: "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/any",
    baseline: "partial" as BaselineStatus,
    suggestion:
      "Fallback: emulate with Promise.race on wrapped promises or a small polyfill.",
  },
  {
    id: "urlpattern",
    title: "URLPattern",
    regex: /\bnew\s+URLPattern\s*\(/g,
    docs: "https://developer.mozilla.org/docs/Web/API/URL_Pattern_API",
    baseline: "partial" as BaselineStatus,
    suggestion:
      "Fallback: use the urlpattern-polyfill or Regex-based matching.",
  },
  {
    id: "view-transitions",
    title: "View Transitions API",
    regex: /document\.(startViewTransition)\b/g,
    docs: "https://developer.mozilla.org/docs/Web/API/Document/startViewTransition",
    baseline: "partial" as BaselineStatus,
    suggestion:
      "Guard: if ('startViewTransition' in document) { ... } else { ... }",
  },
];

const CSS_FEATURES = [
  {
    id: "css-has",
    title: "CSS :has()",
    regex: /:has\s*\(/g,
    docs: "https://developer.mozilla.org/docs/Web/CSS/:has",
    baseline: "partial" as BaselineStatus,
    suggestion:
      "Use progressive enhancement: avoid relying on :has() for critical UI; restructure selectors.",
  },
  {
    id: "css-nesting",
    title: "CSS Nesting",
    regex: /\n\s*&[\s.:#\[>~+]/g,
    docs: "https://developer.mozilla.org/docs/Web/CSS/CSS_nesting",
    baseline: "partial" as BaselineStatus,
    suggestion: "Use PostCSS Nesting or target supported environments.",
  },
  {
    id: "css-container-queries",
    title: "CSS Container Queries",
    regex: /@container\b/g,
    docs: "https://developer.mozilla.org/docs/Web/CSS/CSS_container_queries",
    baseline: "partial" as BaselineStatus,
    suggestion:
      "Provide responsive fallbacks using media queries when container queries are unsupported.",
  },
];

const HTML_FEATURES = [
  {
    id: "html-popover",
    title: "Popover attribute",
    regex: /\bpopover\b/g,
    docs: "https://developer.mozilla.org/docs/Web/API/Popover_API",
    baseline: "partial" as BaselineStatus,
    suggestion: "Fallback: use <dialog> or a custom popover component.",
  },
];

function pushMatches(
  arr: Finding[],
  content: string,
  file: string,
  items: {
    id: string;
    title: string;
    regex: RegExp;
    docs: string;
    baseline: BaselineStatus;
    suggestion?: string;
  }[]
) {
  for (const it of items) {
    it.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = it.regex.exec(content))) {
      const idx = m.index;
      const { line, column } = positionFromIndex(content, idx);
      arr.push({
        file,
        line,
        column,
        featureId: it.id,
        title: it.title,
        baseline: it.baseline,
        severity: it.baseline === "yes" ? "info" : "warn",
        docsUrl: it.docs,
        suggestion: it.suggestion,
      });
    }
  }
}

function positionFromIndex(text: string, index: number) {
  let line = 1,
    col = 1;
  for (let i = 0; i < index; i++) {
    const ch = text.charCodeAt(i);
    if (ch === 10 /* \n */) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
}

export function analyze(
  files: Iterable<FileRef>,
  _options: AnalyzeOptions = {}
): Finding[] {
  const findings: Finding[] = [];
  for (const f of files) {
    const lower = f.path.toLowerCase();
    if (
      lower.endsWith(".js") ||
      lower.endsWith(".ts") ||
      lower.endsWith(".jsx") ||
      lower.endsWith(".tsx")
    ) {
      pushMatches(findings, f.content, f.path, JS_FEATURES);
    } else if (
      lower.endsWith(".css") ||
      lower.endsWith(".scss") ||
      lower.endsWith(".sass")
    ) {
      pushMatches(findings, f.content, f.path, CSS_FEATURES);
    } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
      pushMatches(findings, f.content, f.path, HTML_FEATURES);
    }
  }
  return findings;
}
