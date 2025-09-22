import * as vscode from "vscode";
import { analyze, type FileRef } from "@baseline-tools/core";
import * as fs from "node:fs";
import * as path from "node:path";

const DIAG_COLLECTION = vscode.languages.createDiagnosticCollection("baseline");
let STATUS_ITEM: vscode.StatusBarItem | undefined;
let SCAN_ON_CHANGE = true;

function getVsCodeSettings() {
  try {
    const cfg = vscode.workspace.getConfiguration("baseline");
    return {
      scanOnChange: cfg.get<boolean>("scanOnChange"),
      targets: cfg.get<string[]>("targets"),
      unsupportedThreshold: cfg.get<number>("unsupportedThreshold"),
    } as const;
  } catch {
    return {
      scanOnChange: undefined,
      targets: undefined,
      unsupportedThreshold: undefined,
    } as const;
  }
}

function fileToFileRef(doc: vscode.TextDocument): FileRef | null {
  const lang = doc.languageId;
  const exts = [
    "javascript",
    "typescript",
    "javascriptreact",
    "typescriptreact",
    "css",
    "html",
  ];
  if (!exts.includes(lang)) return null;
  return { path: doc.uri.fsPath, content: doc.getText() };
}

function toRange(
  doc: vscode.TextDocument,
  line: number,
  column: number
): vscode.Range {
  const ln = Math.max(0, line - 1);
  const col = Math.max(0, column - 1);
  return new vscode.Range(
    new vscode.Position(ln, col),
    new vscode.Position(ln, col + 1)
  );
}

function loadTargetsFromWorkspace(
  doc: vscode.TextDocument
): string[] | undefined {
  const vs = getVsCodeSettings();
  if (vs.targets && Array.isArray(vs.targets) && vs.targets.length) {
    return vs.targets;
  }
  const cfg = loadConfig(doc);
  if (cfg?.targets) {
    if (Array.isArray(cfg.targets)) return cfg.targets as string[];
    if (typeof cfg.targets === "string") return [cfg.targets as string];
  }
  // Try nearest package.json from the file's directory upwards
  let dir = path.dirname(doc.uri.fsPath);
  const root = path.parse(dir).root;
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    try {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        const bl = pkg?.browserslist;
        if (!bl) return undefined;
        if (Array.isArray(bl)) return bl as string[];
        if (typeof bl === "string") return [bl as string];
        if (typeof bl === "object" && bl.production)
          return bl.production as string[];
        return undefined;
      }
    } catch {
      // ignore
    }
    if (dir === root) break;
    const next = path.dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return undefined;
}

type BaselineConfig = {
  targets?: string[] | string;
  unsupportedThreshold?: number;
  features?: Record<string, boolean>;
};

function loadConfig(doc: vscode.TextDocument): BaselineConfig | undefined {
  let dir = path.dirname(doc.uri.fsPath);
  const root = path.parse(dir).root;
  while (true) {
    const p = path.join(dir, "baseline.config.json");
    try {
      if (fs.existsSync(p)) {
        const txt = fs.readFileSync(p, "utf8");
        return JSON.parse(txt) as BaselineConfig;
      }
    } catch {
      // ignore
    }
    if (dir === root) break;
    const next = path.dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return undefined;
}

function computeDiagnostics(doc: vscode.TextDocument) {
  const fileRef = fileToFileRef(doc);
  if (!fileRef) {
    DIAG_COLLECTION.delete(doc.uri);
    updateStatusBar(doc);
    return;
  }
  const cfg = loadConfig(doc);
  const vs = getVsCodeSettings();
  const targets = loadTargetsFromWorkspace(doc);
  const findings = analyze([fileRef], { targets });
  const diags: vscode.Diagnostic[] = [];
  for (const f of findings) {
    if (cfg?.features && cfg.features[f.featureId] === false) continue;
    if (f.baseline === "yes") continue;
    if ((f as any).advice === "guarded") continue; // don't warn when already guarded
    const threshold =
      typeof vs.unsupportedThreshold === "number" &&
      vs.unsupportedThreshold >= 0
        ? vs.unsupportedThreshold
        : cfg?.unsupportedThreshold;
    const effAdvice = (() => {
      const a = (f as any).advice as string | undefined;
      if (
        typeof threshold === "number" &&
        a === "needs-guard" &&
        typeof (f as any).unsupportedPercent === "number" &&
        (f as any).unsupportedPercent <= threshold
      )
        return "safe";
      return a || "needs-guard";
    })();
    const range = toRange(doc, f.line, f.column);
    const msgAdvice =
      effAdvice === "guarded"
        ? "Guarded"
        : effAdvice === "safe"
          ? "Safe to adopt"
          : "Needs guard";
    const diag = new vscode.Diagnostic(
      range,
      `${f.title} — ${msgAdvice}`,
      vscode.DiagnosticSeverity.Warning
    );
    diag.code = f.featureId;
    diag.source = "Baseline";
    if (f.docsUrl) {
      (diag as any).docsUrl = f.docsUrl;
    }
    if (f.suggestion) {
      (diag as any).suggestion = f.suggestion;
    }
    if ((f as any).unsupportedPercent != null) {
      (diag as any).unsupportedPercent = (f as any).unsupportedPercent;
    }
    diags.push(diag);
  }
  DIAG_COLLECTION.set(doc.uri, diags);
  updateStatusBar(doc);
}

class HoverProvider implements vscode.HoverProvider {
  provideHover(
    doc: vscode.TextDocument,
    pos: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    const diags = (vscode.languages.getDiagnostics(doc.uri) || []).filter(
      (d: vscode.Diagnostic) => d.range.contains(pos)
    );
    if (diags.length === 0) return;
    const d = diags[0] as any;
    const lines: string[] = [];
    lines.push(`Feature: ${d.message}`);
    if (d.suggestion) lines.push(`Suggestion: ${d.suggestion}`);
    if (d.docsUrl) lines.push(`Docs: ${d.docsUrl}`);
    const targets = loadTargetsFromWorkspace(doc);
    if (targets && targets.length) lines.push(`Targets: ${targets.join(", ")}`);
    if (typeof d.unsupportedPercent === "number")
      lines.push(`~Unsupported: ${d.unsupportedPercent}%`);
    return new vscode.Hover(lines.join("\n"));
  }
}

class CodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];
  private snippetFor(
    featureId:
      | string
      | number
      | (string | number | { value: string | number; target?: vscode.Uri })
      | undefined,
    suggestion: string | undefined,
    doc: vscode.TextDocument
  ): string | undefined {
    const id = typeof featureId === "string" ? featureId : String(featureId);
    const wrap = (body: string) => this.wrapAsComment(doc, body);
    switch (id) {
      case "navigator-share":
        return `if (navigator.share) {\n  await navigator.share({ title: document.title, url: location.href });\n} else {\n  // TODO: fallback\n}`;
      case "url-canparse":
        return `function canParse(u){ try { new URL(u); return true; } catch { return false; } }`;
      case "view-transitions":
        return `if ('startViewTransition' in document) {\n  // document.startViewTransition(() => { /* ... */ })\n} else {\n  // fallback\n}`;
      case "file-system-access-picker":
        return `// Fallback: <input type=\"file\"> for older browsers\nconst input = document.createElement('input');\ninput.type = 'file';\ninput.click();`;
      case "urlpattern":
        return `// Consider urlpattern-polyfill or regex-based matching\n// import 'urlpattern-polyfill';\n// const p = new URLPattern('https://example.com/:id');`;
      case "html-dialog":
        return wrap(
          "Suggestion: consider a dialog polyfill or non-modal fallback; ensure focus trap and Escape closes"
        );
      case "loading-lazy-attr":
        return wrap(
          'Suggestion: for hero/LCP images, prefer loading="eager"; keep lazy for non-critical media'
        );
      case "css-text-wrap-balance":
        return wrap(
          "Suggestion: progressive enhancement; provide reasonable default wrapping where balance unsupported"
        );
      default:
        return suggestion ? wrap(`Suggestion: ${suggestion}`) : undefined;
      case "css-color-mix":
        return `/* Fallback: precompute color-mix() values for older browsers */`;
      case "css-modal-pseudo":
        return `/* Fallback: ensure non-modal behavior when :modal unsupported */`;
    }
  }
  private wrapAsComment(doc: vscode.TextDocument, body: string): string {
    const lang = doc.languageId;
    if (lang === "html") return `<!-- ${body} -->`;
    if (lang === "css") return `/* ${body} */`;
    // default JS/TS/JSX/TSX and others
    return `// ${body}`;
  }
  provideCodeActions(doc: vscode.TextDocument, range: vscode.Range) {
    const actions: vscode.CodeAction[] = [];
    const sel = range
      ? new vscode.Selection(range.start, range.end)
      : undefined;
    const matches = (vscode.languages.getDiagnostics(doc.uri) || []).filter(
      (d: vscode.Diagnostic) => (sel ? d.range.intersection(sel) : true)
    );
    for (const d of matches) {
      const s = (d as any).suggestion as string | undefined;
      const code = this.snippetFor(d.code!, s, doc);
      if (!code) continue;
      const action = new vscode.CodeAction(
        "Insert Baseline guard/fallback (helpers)",
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [d];
      const edit = new vscode.WorkspaceEdit();
      // Ensure helpers import exists for known features
      const text = doc.getText();
      let importLine: string | undefined;
      const id = String(d.code || "");
      if (id === "navigator-share")
        importLine = `import { canShare } from '@baseline-tools/helpers';\n`;
      else if (id === "url-canparse")
        importLine = `import { canParseUrl } from '@baseline-tools/helpers';\n`;
      else if (id === "view-transitions")
        importLine = `import { hasViewTransitions } from '@baseline-tools/helpers';\n`;
      else if (id === "file-system-access-picker")
        importLine = `import { canShowOpenFilePicker } from '@baseline-tools/helpers';\n`;
      if (importLine && !text.includes("@baseline-tools/helpers")) {
        edit.insert(doc.uri, new vscode.Position(0, 0), importLine + "\n");
      }
      // Insert near selection start if the diagnostic is inside selection, else at diagnostic
      const insertPos =
        sel && sel.contains(d.range) ? sel.start : d.range.start;
      edit.insert(doc.uri, insertPos, code + "\n");
      action.edit = edit;
      actions.push(action);
    }
    return actions;
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Load persisted or configured scan mode
  try {
    const cfg = vscode.workspace.getConfiguration("baseline");
    const cfgScan = cfg.get<boolean>("scanOnChange");
    if (typeof cfgScan === "boolean") SCAN_ON_CHANGE = cfgScan;
  } catch {}
  try {
    const persisted = context.workspaceState.get<boolean>(
      "baseline.scanOnChange"
    );
    if (typeof persisted === "boolean") SCAN_ON_CHANGE = persisted;
  } catch {}

  // Status bar item
  STATUS_ITEM = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  STATUS_ITEM.name = "Baseline";
  STATUS_ITEM.command = "baseline.scanWorkspace";
  STATUS_ITEM.tooltip = "Run Baseline scan for open files";
  STATUS_ITEM.show();
  context.subscriptions.push(STATUS_ITEM);

  context.subscriptions.push(DIAG_COLLECTION);
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(computeDiagnostics),
    vscode.workspace.onDidChangeTextDocument(
      (e: vscode.TextDocumentChangeEvent) => {
        if (SCAN_ON_CHANGE) computeDiagnostics(e.document);
      }
    ),
    vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
      if (!SCAN_ON_CHANGE) computeDiagnostics(doc);
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("baseline.targets") ||
        e.affectsConfiguration("baseline.unsupportedThreshold") ||
        e.affectsConfiguration("baseline.scanOnChange")
      ) {
        const s = getVsCodeSettings();
        if (typeof s.scanOnChange === "boolean")
          SCAN_ON_CHANGE = s.scanOnChange;
        const ed = vscode.window.activeTextEditor;
        if (ed?.document) {
          computeDiagnostics(ed.document);
          updateStatusBar(ed.document);
        }
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc: vscode.TextDocument) =>
      DIAG_COLLECTION.delete(doc.uri)
    ),
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (ed?.document) updateStatusBar(ed.document);
    }),
    vscode.languages.onDidChangeDiagnostics(() => {
      const ed = vscode.window.activeTextEditor;
      if (ed?.document) updateStatusBar(ed.document);
    }),
    vscode.languages.registerHoverProvider(
      [
        { scheme: "file", language: "javascript" },
        { scheme: "file", language: "typescript" },
        { scheme: "file", language: "javascriptreact" },
        { scheme: "file", language: "typescriptreact" },
        { scheme: "file", language: "css" },
        { scheme: "file", language: "html" },
      ],
      new HoverProvider()
    ),
    vscode.languages.registerCodeActionsProvider(
      [
        "javascript",
        "typescript",
        "javascriptreact",
        "typescriptreact",
        "css",
        "html",
      ],
      new CodeActionProvider(),
      { providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds }
    ),
    vscode.commands.registerCommand("baseline.scanWorkspace", async () => {
      const docs = vscode.workspace.textDocuments;
      for (const doc of docs) computeDiagnostics(doc);
      vscode.window.showInformationMessage("Baseline scan complete.");
    }),
    vscode.commands.registerCommand("baseline.toggleScanMode", async () => {
      SCAN_ON_CHANGE = !SCAN_ON_CHANGE;
      await context.workspaceState.update(
        "baseline.scanOnChange",
        SCAN_ON_CHANGE
      );
      vscode.window.showInformationMessage(
        `Baseline: scan on ${SCAN_ON_CHANGE ? "change" : "save"}`
      );
    })
  );
  // Initial scan for currently open docs
  for (const doc of vscode.workspace.textDocuments) computeDiagnostics(doc);
}

export function deactivate() {
  DIAG_COLLECTION.dispose();
}

function updateStatusBar(doc: vscode.TextDocument) {
  if (!STATUS_ITEM) return;
  const diags = vscode.languages
    .getDiagnostics(doc.uri)
    .filter((d) => d.source === "Baseline");
  const count = diags.length;
  const cfg = loadConfig(doc);
  const targets = loadTargetsFromWorkspace(doc);
  const tgt = targets && targets.length ? `${targets.join(", ")}` : "auto";
  const mode = SCAN_ON_CHANGE ? "change" : "save";
  STATUS_ITEM.text = `$(shield) Baseline: ${count} • ${tgt} • ${mode}`;
}
