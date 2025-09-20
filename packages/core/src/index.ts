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

export function analyze(
  files: Iterable<FileRef>,
  _options: AnalyzeOptions = {}
): Finding[] {
  // Placeholder: wire real analyzers in subsequent steps
  const findings: Finding[] = [];
  for (const f of files) {
    if (f.content.includes("structuredClone(")) {
      findings.push({
        file: f.path,
        line: 1,
        column: 1,
        featureId: "structured-clone",
        title: "structuredClone()",
        baseline: "yes",
        severity: "info",
        docsUrl: "https://developer.mozilla.org/docs/Web/API/structuredClone",
        suggestion:
          "Prefer structuredClone over deep-clone utilities where supported.",
      });
    }
  }
  return findings;
}
