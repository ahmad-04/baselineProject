import * as vscode from "vscode";
import { analyze, type FileRef } from "baseline-tools-core";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const DIAG_COLLECTION = vscode.languages.createDiagnosticCollection("baseline");
let STATUS_ITEM: vscode.StatusBarItem | undefined;
let SCAN_ON_CHANGE = true;
let USE_LSP = false;
let LSP_PROC: ChildProcessWithoutNullStreams | undefined;
const DEBOUNCE_TIMERS = new Map<string, NodeJS.Timeout>();
const PENDING_TOKENS = new Map<string, string>();
const APPLIED_TOKENS = new Map<string, string>();

function lspAvailable(): boolean {
  try {
    const extRoot = contextGlobal?.extensionPath || __dirname;
    // The lsp server entry after build
    const serverPath = path.resolve(
      extRoot,
      "../../packages/lsp-server/dist/server.js"
    );
    return fs.existsSync(serverPath);
  } catch {
    return false;
  }
}

let contextGlobal: vscode.ExtensionContext | undefined;

function startLspIfEnabled(context: vscode.ExtensionContext) {
  contextGlobal = context;
  try {
    const cfg = vscode.workspace.getConfiguration("baseline");
    USE_LSP = !!cfg.get<boolean>("useLsp");
  } catch {}
  if (!USE_LSP) return;
  const extRoot = context.extensionPath;
  const serverPath = path.resolve(
    extRoot,
    "../../packages/lsp-server/dist/server.js"
  );
  if (!fs.existsSync(serverPath)) {
    USE_LSP = false;
    return;
  }
  try {
    LSP_PROC = spawn(process.execPath, [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    LSP_PROC.on("exit", () => {
      USE_LSP = false;
      LSP_PROC = undefined;
    });
  } catch {
    USE_LSP = false;
  }
}

function lspAnalyzeText(
  uri: string,
  text: string,
  targets?: string[]
): Promise<{ findings: any[]; id: string } | undefined> {
  if (!LSP_PROC) return Promise.resolve(undefined);
  const id = Math.random().toString(36).slice(2);
  const req = {
    jsonrpc: "2.0",
    id,
    method: "baseline/analyzeText",
    params: { uri, text, targets },
  };
  const s = JSON.stringify(req);
  const buf = Buffer.from(s, "utf8");
  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      const str = chunk.toString("utf8");
      const idx = str.indexOf("\r\n\r\n");
      const body = idx >= 0 ? str.slice(idx + 4) : str;
      try {
        const rsp = JSON.parse(body);
        if (rsp && rsp.id === id) {
          LSP_PROC!.stdout.off("data", onData);
          resolve({ findings: rsp.result?.findings ?? [], id });
        }
      } catch {
        // ignore
      }
    };
    LSP_PROC!.stdout.on("data", onData);
    LSP_PROC!.stdin.write(`Content-Length: ${buf.length}\r\n\r\n`);
    LSP_PROC!.stdin.write(buf);
  });
}

function lspFixAll(
  uri: string,
  text: string,
  languageId: string,
  targets?: string[]
): Promise<
  Array<{ line: number; column: number; insertText: string }> | undefined
> {
  if (!LSP_PROC) return Promise.resolve(undefined);
  const id = Math.random().toString(36).slice(2);
  const req = {
    jsonrpc: "2.0",
    id,
    method: "baseline/fixAll",
    params: { uri, text, language: languageId, targets },
  };
  const s = JSON.stringify(req);
  const buf = Buffer.from(s, "utf8");
  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      const str = chunk.toString("utf8");
      const idx = str.indexOf("\r\n\r\n");
      const body = idx >= 0 ? str.slice(idx + 4) : str;
      try {
        const rsp = JSON.parse(body);
        if (rsp && rsp.id === id) {
          LSP_PROC!.stdout.off("data", onData);
          resolve((rsp.result?.edits as any[]) ?? []);
        }
      } catch {
        // ignore
      }
    };
    LSP_PROC!.stdout.on("data", onData);
    LSP_PROC!.stdin.write(`Content-Length: ${buf.length}\r\n\r\n`);
    LSP_PROC!.stdin.write(buf);
  });
}

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
  const doSet = (findings: any[]) => {
    const diags: vscode.Diagnostic[] = [];
    for (const f of findings) {
      if (cfg?.features && cfg.features[f.featureId] === false) continue;
      if (f.baseline === "yes") continue;
      if ((f as any).advice === "guarded") continue;
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
  };
  if (USE_LSP && LSP_PROC) {
    const docPath = doc.uri.fsPath;
    const token = Math.random().toString(36).slice(2);
    PENDING_TOKENS.set(docPath, token);
    setTimeout(() => {
      if (
        PENDING_TOKENS.get(docPath) === token &&
        APPLIED_TOKENS.get(docPath) !== token
      ) {
        const localFindings = analyze([fileRef], { targets });
        doSet(localFindings);
        APPLIED_TOKENS.set(docPath, token);
      }
    }, 300);
    lspAnalyzeText(doc.uri.fsPath, fileRef.content, targets).then((res) => {
      if (!res) {
        if (PENDING_TOKENS.get(docPath) === token) {
          const localFindings = analyze([fileRef], { targets });
          doSet(localFindings);
          APPLIED_TOKENS.set(docPath, token);
        }
        return;
      }
      if (PENDING_TOKENS.get(docPath) !== token) return;
      doSet(res.findings);
      APPLIED_TOKENS.set(docPath, token);
    });
  } else {
    const findings = analyze([fileRef], { targets });
    doSet(findings);
  }
}

function scheduleDiagnostics(doc: vscode.TextDocument, delay = 200) {
  const key = doc.uri.toString();
  const t = DEBOUNCE_TIMERS.get(key);
  if (t) clearTimeout(t);
  const h = setTimeout(() => computeDiagnostics(doc), delay);
  DEBOUNCE_TIMERS.set(key, h);
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
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.SourceFixAll,
  ];
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
    // Provide a source action to fix all in the file
    const fixAll = new vscode.CodeAction(
      "Baseline: Fix all in file",
      vscode.CodeActionKind.SourceFixAll
    );
    fixAll.command = {
      command: "baseline.fixAll",
      title: "Baseline: Fix all in file",
      arguments: [doc.uri],
    };
    actions.push(fixAll);
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
  importLine = `import { canShare } from 'baseline-tools-helpers';\n`;
      else if (id === "url-canparse")
  importLine = `import { canParseUrl } from 'baseline-tools-helpers';\n`;
      else if (id === "view-transitions")
  importLine = `import { hasViewTransitions } from 'baseline-tools-helpers';\n`;
      else if (id === "file-system-access-picker")
  importLine = `import { canShowOpenFilePicker } from 'baseline-tools-helpers';\n`;
  if (importLine && !text.includes("baseline-tools-helpers")) {
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
  startLspIfEnabled(context);
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
        if (SCAN_ON_CHANGE) scheduleDiagnostics(e.document, 200);
      }
    ),
    vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
      if (!SCAN_ON_CHANGE) scheduleDiagnostics(doc, 0);
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
    vscode.commands.registerCommand("baseline.restartLsp", async () => {
      if (LSP_PROC) {
        try {
          LSP_PROC.kill();
        } catch {}
        LSP_PROC = undefined;
      }
      startLspIfEnabled(context);
      vscode.window.showInformationMessage(
        USE_LSP
          ? "Baseline LSP restarted."
          : "Baseline LSP not enabled or unavailable."
      );
      const ed = vscode.window.activeTextEditor;
      if (ed?.document) computeDiagnostics(ed.document);
    }),
    vscode.commands.registerCommand(
      "baseline.fixAll",
      async (uri?: vscode.Uri) => {
        try {
          const doc = uri
            ? await vscode.workspace.openTextDocument(uri)
            : vscode.window.activeTextEditor?.document;
          if (!doc) return;
          const fileRef = fileToFileRef(doc);
          if (!fileRef) return;
          const targets = loadTargetsFromWorkspace(doc);
          let edits:
            | Array<{ line: number; column: number; insertText: string }>
            | undefined;
          if (USE_LSP && LSP_PROC) {
            edits = await lspFixAll(
              doc.uri.fsPath,
              fileRef.content,
              doc.languageId,
              targets
            );
          }
          if (!edits) {
            const findings = analyze([fileRef], { targets }) as any[];
            const wrap = (body: string) => {
              const lang = doc.languageId;
              if (lang === "html") return `<!-- ${body} -->`;
              if (lang === "css") return `/* ${body} */`;
              return `// ${body}`;
            };
            edits = findings
              .filter(
                (f) => (f as any).advice !== "guarded" && f.baseline !== "yes"
              )
              .map((f) => {
                const s = (f as any).suggestion as string | undefined;
                const body = s
                  ? `Suggestion: ${s}`
                  : f.docsUrl
                    ? `See docs: ${f.docsUrl}`
                    : `Consider guards or a fallback`;
                return {
                  line: f.line,
                  column: f.column,
                  insertText: wrap(body) + "\n",
                };
              });
          }
          if (edits && edits.length) {
            const we = new vscode.WorkspaceEdit();
            for (const e of edits) {
              const pos = new vscode.Position(
                Math.max(0, e.line - 1),
                Math.max(0, e.column - 1)
              );
              we.insert(doc.uri, pos, e.insertText);
            }
            await vscode.workspace.applyEdit(we);
            vscode.window.showInformationMessage(
              `Baseline: applied ${edits.length} suggestions.`
            );
          } else {
            vscode.window.showInformationMessage(
              "Baseline: no suggestions to apply."
            );
          }
        } catch (err) {
          vscode.window.showErrorMessage(`Baseline fix-all failed: ${err}`);
        }
      }
    ),
    vscode.commands.registerCommand("baseline.toggleScanMode", async () => {
      SCAN_ON_CHANGE = !SCAN_ON_CHANGE;
      await context.workspaceState.update(
        "baseline.scanOnChange",
        SCAN_ON_CHANGE
      );
      vscode.window.showInformationMessage(
        `Baseline: scan on ${SCAN_ON_CHANGE ? "change" : "save"}`
      );
    }),
    vscode.commands.registerCommand("baseline.pickTargets", async () => {
      const cfg = vscode.workspace.getConfiguration("baseline");
      const presets: Array<{ label: string; value: string[] }> = [
        { label: ">0.5% and not dead", value: [">0.5%", "not dead"] },
        { label: "Defaults (auto)", value: [] },
        { label: "Chrome >= 120", value: ["chrome >= 120"] },
        {
          label: "Firefox ESR + latest",
          value: ["firefox esr", "last 1 firefox version"],
        },
        { label: "Safari 17+", value: ["safari >= 17"] },
      ];
      const picked = await vscode.window.showQuickPick(
        presets.map((p) => p.label),
        { title: "Baseline Targets", placeHolder: "Select a targets preset" }
      );
      if (!picked) return;
      const preset = presets.find((p) => p.label === picked)!;
      await cfg.update(
        "targets",
        preset.value,
        vscode.ConfigurationTarget.Workspace
      );
      const thr = await vscode.window.showInputBox({
        title: "Unsupported Threshold (percent, -1 to disable)",
        value: String(cfg.get<number>("unsupportedThreshold") ?? -1),
        validateInput: (v) =>
          /^-?\d+$/.test(v)
            ? undefined
            : "Enter an integer (e.g. -1, 0, 5, 10)",
      });
      if (thr != null && /^-?\d+$/.test(thr)) {
        await cfg.update(
          "unsupportedThreshold",
          parseInt(thr, 10),
          vscode.ConfigurationTarget.Workspace
        );
      }
      const ed = vscode.window.activeTextEditor;
      if (ed?.document) computeDiagnostics(ed.document);
      vscode.window.showInformationMessage(
        "Baseline: targets/threshold updated."
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
  const lsp = USE_LSP ? "lsp" : "local";
  STATUS_ITEM.text = `$(shield) Baseline: ${count} • ${tgt} • ${mode} • ${lsp}`;
}
