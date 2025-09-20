import * as vscode from "vscode";
import { analyze, type FileRef } from "@baseline-tools/core";
import * as fs from "node:fs";
import * as path from "node:path";

const DIAG_COLLECTION = vscode.languages.createDiagnosticCollection("baseline");

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

function computeDiagnostics(doc: vscode.TextDocument) {
  const fileRef = fileToFileRef(doc);
  if (!fileRef) {
    DIAG_COLLECTION.delete(doc.uri);
    return;
  }
  const targets = loadTargetsFromWorkspace(doc);
  const findings = analyze([fileRef], { targets });
  const diags: vscode.Diagnostic[] = [];
  for (const f of findings) {
    if (f.baseline === "yes") continue;
    if ((f as any).advice === "guarded") continue; // don't warn when already guarded
    const range = toRange(doc, f.line, f.column);
    const msgAdvice =
      (f as any).advice === "guarded"
        ? "Guarded"
        : (f as any).advice === "safe"
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
    diags.push(diag);
  }
  DIAG_COLLECTION.set(doc.uri, diags);
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
    suggestion?: string
  ): string | undefined {
    const id = typeof featureId === "string" ? featureId : String(featureId);
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
      default:
        return suggestion ? `// ${suggestion}` : undefined;
    }
  }
  provideCodeActions(doc: vscode.TextDocument, range: vscode.Range) {
    const actions: vscode.CodeAction[] = [];
    const matches = (vscode.languages.getDiagnostics(doc.uri) || []).filter(
      (d: vscode.Diagnostic) => d.range.intersection(range)
    );
    for (const d of matches) {
      const s = (d as any).suggestion as string | undefined;
      const code = this.snippetFor(d.code!, s);
      if (!code) continue;
      const action = new vscode.CodeAction(
        "Insert Baseline guard/fallback",
        vscode.CodeActionKind.QuickFix
      );
      action.diagnostics = [d];
      action.edit = new vscode.WorkspaceEdit();
      action.edit.insert(doc.uri, d.range.start, code + "\n");
      actions.push(action);
    }
    return actions;
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(DIAG_COLLECTION);
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(computeDiagnostics),
    vscode.workspace.onDidChangeTextDocument(
      (e: vscode.TextDocumentChangeEvent) => computeDiagnostics(e.document)
    ),
    vscode.workspace.onDidCloseTextDocument((doc: vscode.TextDocument) =>
      DIAG_COLLECTION.delete(doc.uri)
    ),
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
    })
  );
  // Initial scan for currently open docs
  for (const doc of vscode.workspace.textDocuments) computeDiagnostics(doc);
}

export function deactivate() {
  DIAG_COLLECTION.dispose();
}
