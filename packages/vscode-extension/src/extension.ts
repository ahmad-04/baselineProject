import * as vscode from "vscode";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const DIAG_COLLECTION = vscode.languages.createDiagnosticCollection("baseline");

// Local lightweight type to avoid compile-time dependency on core types
type FileRef = { path: string; content: string };

// Resolve analyzer at runtime to support VSIX installs
let analyze: (
  files: Iterable<FileRef>,
  options?: { targets?: string[] }
) => any[] = () => [];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ analyze } = require("@whoisahmad/baseline-tools-core"));
} catch {
  try {
    // Fallback to bundled copy: dist/core-dist/index.js (copied during packaging)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ analyze } = require(path.resolve(__dirname, "core-dist/index.js")));
  } catch (e) {
    console.error("Baseline: failed to load analyzer module", e);
  }
}
if (analyze === (((): any[] => []) as any)) {
  console.error(
    "Baseline: analyzer unavailable. Extension will be idle until the analyzer can be resolved."
  );
}
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
    "scss",
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
  if (analyze === (((): any[] => []) as any)) {
    // Analyzer not available, clear diagnostics and return gracefully
    DIAG_COLLECTION.delete(doc.uri);
    updateStatusBar(doc);
    return;
  }
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
      // Do not show diagnostics for safe findings
      if (effAdvice === "safe") continue;
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

// Compute diagnostics for a file path without opening it in an editor
async function computeDiagnosticsForPath(filePath: string) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      ".js": "javascript",
      ".ts": "typescript",
      ".jsx": "javascriptreact",
      ".tsx": "typescriptreact",
      ".css": "css",
      ".scss": "scss",
      ".htm": "html",
      ".html": "html",
    };
    const languageId = langMap[ext];
    if (!languageId) return; // Unsupported
    if (analyze === (((): any[] => []) as any)) return;
    const content = fs.readFileSync(filePath, "utf8");
    const findings = analyze([{ path: filePath, content }], {
      targets: loadTargetsFromPath(filePath),
    });
    const cfg = loadConfigLike(filePath);
    const vs = getVsCodeSettings();
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
      const a = (f as any).advice as string | undefined;
      const effAdvice =
        typeof threshold === "number" &&
        a === "needs-guard" &&
        typeof (f as any).unsupportedPercent === "number" &&
        (f as any).unsupportedPercent <= threshold
          ? "safe"
          : a || "needs-guard";
      if (effAdvice === "safe") continue;
      const range = new vscode.Range(
        new vscode.Position(Math.max(0, f.line - 1), Math.max(0, f.column - 1)),
        new vscode.Position(Math.max(0, f.line - 1), Math.max(0, f.column))
      );
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
      (diag as any).docsUrl = (f as any).docsUrl;
      (diag as any).suggestion = (f as any).suggestion;
      if ((f as any).unsupportedPercent != null) {
        (diag as any).unsupportedPercent = (f as any).unsupportedPercent;
      }
      diags.push(diag);
    }
    DIAG_COLLECTION.set(vscode.Uri.file(filePath), diags);
  } catch (err) {
    // Ignore individual file errors
  }
}

function loadTargetsFromPath(filePath: string): string[] | undefined {
  // Reuse logic from loadTargetsFromWorkspace but path-based
  let dir = path.dirname(filePath);
  const root = path.parse(dir).root;
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    try {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        const bl = pkg?.browserslist;
        if (!bl) break;
        if (Array.isArray(bl)) return bl as string[];
        if (typeof bl === "string") return [bl as string];
        if (typeof bl === "object" && bl.production)
          return bl.production as string[];
        break;
      }
    } catch {}
    if (dir === root) break;
    const next = path.dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return undefined;
}

function loadConfigLike(filePath: string): {
  targets?: string[] | string;
  unsupportedThreshold?: number;
  features?: Record<string, boolean>;
} | undefined {
  let dir = path.dirname(filePath);
  const root = path.parse(dir).root;
  while (true) {
    const p = path.join(dir, "baseline.config.json");
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch {}
    if (dir === root) break;
    const next = path.dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return undefined;
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
    const lang = doc.languageId;

    switch (id) {
      case "navigator-share":
        return `if (navigator && 'share' in navigator) {
  await navigator.share({ 
    title: document.title, 
    url: location.href 
  });
} else {
  // Fallback: implement sharing via another method
  console.log('Web Share API not supported');
  // For example: show a custom share dialog with copy to clipboard
}`;
      case "url-canparse":
        return `function canParseUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}`;
      case "view-transitions":
        return `if (document && 'startViewTransition' in document) {
  document.startViewTransition(() => {
    // Your view transition code here
    // Update DOM elements that need transition effects
  });
} else {
  // Fallback for browsers without View Transitions API
  // Directly apply changes without animation
  // Example: document.getElementById('content').innerHTML = newContent;
}`;
      case "file-system-access-picker":
        return `async function openFile() {
  if ('showOpenFilePicker' in window) {
    try {
      const [fileHandle] = await window.showOpenFilePicker();
      return await fileHandle.getFile();
    } catch (err) {
      console.error('File system access error:', err);
    }
  } else {
    // Fallback for browsers without File System Access API
    const input = document.createElement('input');
    input.type = 'file';
    return new Promise(resolve => {
      input.onchange = () => resolve(input.files[0]);
      input.click();
    });
  }
}`;
      case "urlpattern":
        return `// URLPattern API with polyfill fallback
function matchPattern(pattern, url) {
  if (typeof URLPattern === 'function') {
    return new URLPattern(pattern).test(url);
  } else {
    // Consider using urlpattern-polyfill:
    // import 'urlpattern-polyfill';
    
    // Or use a simple regex-based fallback:
    const regexStr = pattern.replace(/:\\w+/g, '([^/]+)');
    const regex = new RegExp(regexStr);
    return regex.test(url);
  }
}`;
      case "html-dialog":
        if (lang === "html") {
          return `<!-- Dialog with fallback -->
<dialog id="myDialog" class="modal">
  <form method="dialog">
    <h2>Dialog Title</h2>
    <p>Dialog content here</p>
    <button id="closeDialog">Close</button>
  </form>
</dialog>

<script>
  const dialog = document.getElementById('myDialog');
  const closeBtn = document.getElementById('closeDialog');
  
  // Show dialog with fallback
  function showDialog() {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      // Fallback for browsers without dialog support
      dialog.setAttribute('open', '');
      dialog.style.position = 'fixed';
      dialog.style.top = '50%';
      dialog.style.left = '50%';
      dialog.style.transform = 'translate(-50%, -50%)';
      dialog.style.zIndex = '100';
      dialog.style.display = 'block';
      
      // Add backdrop
      const backdrop = document.createElement('div');
      backdrop.id = 'dialog-backdrop';
      backdrop.style.position = 'fixed';
      backdrop.style.top = '0';
      backdrop.style.left = '0';
      backdrop.style.right = '0';
      backdrop.style.bottom = '0';
      backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
      backdrop.style.zIndex = '99';
      document.body.appendChild(backdrop);
      
      // Focus management
      dialog.focus();
    }
  }
  
  // Close dialog with fallback
  function closeDialog() {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      dialog.style.display = 'none';
      const backdrop = document.getElementById('dialog-backdrop');
      if (backdrop) backdrop.remove();
    }
  }
  
  closeBtn.addEventListener('click', closeDialog);
</script>`;
        }
        return wrap(
          "Consider using a dialog polyfill or implementing a non-modal fallback with focus trap and Escape key support"
        );

      case "loading-lazy-attr":
        if (lang === "html") {
          return `<!-- Progressive enhancement for image loading -->
<!-- Critical/Hero images: use eager loading -->
<img src="hero.jpg" loading="eager" alt="Hero image" />

<!-- Below-the-fold images: use lazy loading with fallback -->
<script>
  // Feature detection for loading="lazy"
  const supportsLazyLoad = 'loading' in HTMLImageElement.prototype;
  
  // For browsers without native lazy loading, you could:
  // 1. Leave as-is (images load normally)
  // 2. Use a lazy loading library
  // 3. Implement a simple intersection observer
  
  if (!supportsLazyLoad) {
    // Optional: add a lazy loading library here
    // or implement with Intersection Observer
  }
</script>
<img src="below-fold.jpg" loading="lazy" alt="Below fold image" />`;
        }
        return wrap(
          'For hero/LCP images, prefer loading="eager"; use loading="lazy" only for non-critical media'
        );

      case "css-text-wrap-balance":
        if (lang === "css") {
          return `/* Progressive enhancement for text-wrap: balance */
.heading {
  /* Base styles for all browsers */
  max-width: 30ch;
  text-align: center;
  
  /* Modern browsers with text-wrap support */
  text-wrap: balance;
}

/* Optional: @supports rule for additional styling based on support */
@supports (text-wrap: balance) {
  .heading {
    /* Additional styles for browsers with text-wrap support */
  }
}`;
        }
        return wrap(
          "Use progressive enhancement; provide reasonable default wrapping where balance is unsupported"
        );

      case "css-color-mix":
        if (lang === "css") {
          return `/* Fallback for browsers without color-mix() */
:root {
  /* Pre-computed fallback colors */
  --mixed-color-50-50: #7a7acf; /* Equivalent of color-mix(in srgb, blue 50%, red 50%) */
  --mixed-color-25-75: #bf3fbf; /* Equivalent of color-mix(in srgb, blue 25%, red 75%) */
}

.element {
  /* Fallback first */
  background-color: var(--mixed-color-50-50);
  /* Then the modern syntax for browsers that support it */
  background-color: color-mix(in srgb, blue 50%, red 50%);
}

/* Using @supports to provide alternative styling */
@supports (background-color: color-mix(in srgb, red, blue)) {
  .element {
    /* No need for fallback here, we know color-mix is supported */
  }
}`;
        }
        return wrap(
          "Precompute color-mix() values for older browsers and use them as fallbacks"
        );

      case "css-modal-pseudo":
        if (lang === "css") {
          return `/* Progressive enhancement for :modal pseudo-class */
/* Base styles for all dialog elements */
dialog {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Styles for modal dialogs using attribute selector as fallback */
dialog[open] {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
}

/* Modern browsers with :modal support */
dialog:modal {
  /* Additional styles for true modal dialogs */
  max-width: 80vw;
  max-height: 80vh;
}`;
        }
        return wrap(
          "Ensure non-modal behavior when :modal is unsupported using attribute selectors as fallback"
        );

      default:
        // Try to generate a reasonable detection and fallback based on the feature ID
        const featureParts = id.split("-");

        // For navigator APIs
        if (id.startsWith("navigator-") && featureParts.length > 1) {
          const apiName = featureParts[1];
          return `// Feature detection for navigator.${apiName}
if (navigator && '${apiName}' in navigator) {
  // Use navigator.${apiName} here
  // Example: const result = await navigator.${apiName}(...);
} else {
  // Fallback implementation
  console.log('navigator.${apiName} not supported');
  ${suggestion ? "// " + suggestion : "// Implement appropriate fallback here"}
}`;
        }

        // For document APIs
        if (id.startsWith("document-") && featureParts.length > 1) {
          const apiName = featureParts[1];
          return `// Feature detection for document.${apiName}
if (document && '${apiName}' in document) {
  // Use document.${apiName} here
  // Example: document.${apiName}(...);
} else {
  // Fallback implementation
  console.log('document.${apiName} not supported');
  ${suggestion ? "// " + suggestion : "// Implement appropriate fallback here"}
}`;
        }

        // For window APIs
        if (id.startsWith("window-") && featureParts.length > 1) {
          const apiName = featureParts[1];
          return `// Feature detection for window.${apiName}
if ('${apiName}' in window) {
  // Use window.${apiName} here
  // Example: window.${apiName}(...);
} else {
  // Fallback implementation
  console.log('window.${apiName} not supported');
  ${suggestion ? "// " + suggestion : "// Implement appropriate fallback here"}
}`;
        }

        return suggestion
          ? wrap(`Suggestion: ${suggestion}`)
          : wrap(`Consider adding feature detection and fallback for ${id}`);
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
      // Note: do not auto-insert helper imports to avoid breaking builds.
      // Snippets below are self-contained and do not require extra deps.
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
    // Do not clear diagnostics on close; keep them visible in Problems view
    // Add file system watchers to update diagnostics when files change or are deleted
    (() => {
      const watcher = vscode.workspace.createFileSystemWatcher(
        "**/*.{js,ts,jsx,tsx,html,htm,css,scss}"
      );
      const recompute = async (uri: vscode.Uri) => {
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          computeDiagnostics(doc);
        } catch (e) {
          // If file can't be opened (e.g., binary or moved), clear diagnostics
          DIAG_COLLECTION.delete(uri);
        }
      };
      watcher.onDidChange(recompute);
      watcher.onDidCreate(recompute);
      watcher.onDidDelete((uri) => DIAG_COLLECTION.delete(uri));
      return watcher;
    })(),
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
        { scheme: "file", language: "scss" },
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
        "scss",
        "html",
      ],
      new CodeActionProvider(),
      { providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds }
    ),
    vscode.commands.registerCommand("baseline.scanWorkspace", async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Baseline: Scanning workspace...",
          cancellable: true,
        },
        async (progress, token) => {
          // First scan open documents for immediate feedback
          const openDocs = vscode.workspace.textDocuments;
          for (const doc of openDocs) {
            if (token.isCancellationRequested) return;
            computeDiagnostics(doc);
            progress.report({
              message: `Scanning open file: ${path.basename(doc.uri.fsPath)}`,
            });
          }

          // Then scan all relevant files in the workspace
          const supportedExtensions = [
            "js",
            "ts",
            "jsx",
            "tsx",
            "html",
            "htm",
            "css",
            "scss",
          ];
          let scannedCount = 0;

          for (const workspaceFolder of vscode.workspace.workspaceFolders ||
            []) {
            if (token.isCancellationRequested) return;

            // Load ignore patterns from baseline.config.json at workspace root (like CLI)
            const wsRoot = workspaceFolder.uri.fsPath;
            let ignores: string[] = [];
            try {
              const cfgPath = path.join(wsRoot, "baseline.config.json");
              if (fs.existsSync(cfgPath)) {
                const raw = fs.readFileSync(cfgPath, "utf8");
                const cfg = JSON.parse(raw) as { ignore?: string[] };
                if (Array.isArray(cfg.ignore)) ignores = cfg.ignore;
              }
            } catch {}
            // Default excludes for noise and generated artifacts
            const defaultExcludes = [
              "**/node_modules/**",
              "**/dist/**",
              "**/build/**",
              "**/.*/**", // dot folders like .git
              "**/baseline-report.*",
              "**/*.sarif",
              "**/*.vsix",
              "**/.baseline-scan-cache.json",
            ];
            const excludeParts = [...defaultExcludes, ...ignores];
            const excludeGlob = excludeParts.length
              ? `{${excludeParts.join(",")}}`
              : "**/node_modules/**";

            const pattern = new vscode.RelativePattern(
              workspaceFolder,
              `**/*.{${supportedExtensions.join(",")}}`
            );

            const files = await vscode.workspace.findFiles(
              pattern,
              excludeGlob
            );

            for (const fileUri of files) {
              if (token.isCancellationRequested) return;
              const fsPath = fileUri.fsPath;
              if (
                openDocs.some((d) => d.uri.toString() === fileUri.toString())
              ) {
                // already covered above
                continue;
              }
              await computeDiagnosticsForPath(fsPath);
              scannedCount++;
              if (scannedCount % 25 === 0) {
                progress.report({
                  message: `Scanning workspace: ${scannedCount}/${files.length} files`,
                });
              }
            }
          }

          vscode.window.showInformationMessage(
            `Baseline scan complete: ${scannedCount + openDocs.length} files scanned.`
          );
        }
      );
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
            // Debug: Log findings to console to see what's being detected
            console.log(
              "Baseline findings:",
              findings.map((f) => ({
                featureId: f.featureId,
                code: f.code,
                title: f.title,
                baseline: f.baseline,
                advice: (f as any).advice,
                line: f.line,
                column: f.column,
              }))
            );

            // Enhance detection for specific known patterns
            findings.forEach((f) => {
              const content = doc.getText();
              const line = content.split("\n")[Math.max(0, f.line - 1)];

              // Special case for URL.canParse
              if (line && line.includes("URL.canParse")) {
                f.featureId = "url-canparse";
                console.log("Enhanced detection: Found URL.canParse usage");
              }

              // Special case for navigator.share
              if (line && line.includes("navigator.share")) {
                f.featureId = "navigator-share";
                console.log("Enhanced detection: Found navigator.share usage");
              }
            });

            // Function to generate appropriate guard code based on feature ID
            const generateGuardCode = (
              featureId: string,
              suggestion?: string,
              lang = "javascript"
            ) => {
              switch (featureId) {
                case "navigator-share":
                case "navigator.share":
                  return `if (navigator && 'share' in navigator) {
  try {
    await navigator.share({ 
      title: document.title || "Shared content", 
      url: location.href 
    });
    console.log('Content shared successfully');
  } catch (error) {
    console.error('Error sharing:', error);
  }
} else {
  // Fallback: implement sharing via another method
  console.log('Web Share API not supported');
  // You could show a custom share dialog with social media links or copy to clipboard
}`;
                case "url-canparse":
                case "url.canparse":
                  return `function canParseUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Use the canParseUrl function instead of URL.canParse
const isValidUrl = canParseUrl("https://test.com");`;
                case "view-transitions":
                  return `if (document && 'startViewTransition' in document) {
  document.startViewTransition(() => {
    // Your view transition code
  });
} else {
  // Fallback for browsers without View Transitions API
  // Directly apply changes without animation
}`;
                case "file-system-access-picker":
                  return `async function openFile() {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await window.showOpenFilePicker();
      return await handle.getFile();
    } catch (err) {
      console.error('File system access error:', err);
    }
  } else {
    // Fallback for browsers without File System Access API
    const input = document.createElement('input');
    input.type = 'file';
    return new Promise(resolve => {
      input.onchange = () => resolve(input.files[0]);
      input.click();
    });
  }
}`;
                case "urlpattern":
                  return `// URLPattern API fallback
function matchPattern(pattern, url) {
  if (typeof URLPattern === 'function') {
    return new URLPattern(pattern).test(url);
  } else {
    // Simple regex-based fallback
    // Convert pattern to regex (this is simplified)
    const regexStr = pattern.replace(/:\\w+/g, '([^/]+)');
    const regex = new RegExp(regexStr);
    return regex.test(url);
  }
}`;
                case "css-color-mix":
                  if (lang === "css") {
                    return `/* Fallback for browsers without color-mix() */
:root {
  --mixed-color: #7a7acf; /* Pre-computed equivalent of color-mix() */
}
.element {
  /* Fallback first */
  background-color: var(--mixed-color);
  /* Then the modern syntax */
  background-color: color-mix(in srgb, blue 50%, red 50%);
}`;
                  }
                  return null;
                case "css-text-wrap-balance":
                  if (lang === "css") {
                    return `/* Progressive enhancement for text-wrap: balance */
.heading {
  /* Base styles for all browsers */
  max-width: 30ch;
  /* Modern browsers with text-wrap support */
  text-wrap: balance;
}`;
                  }
                  return null;
                case "html-dialog":
                  if (lang === "html") {
                    return `<!-- Dialog with fallback -->
<dialog id="myDialog" class="modal">
  <form method="dialog">
    <h2>Dialog Title</h2>
    <p>Dialog content here</p>
    <button>Close</button>
  </form>
</dialog>

<script>
  const dialog = document.getElementById('myDialog');
  const showDialog = () => {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      // Fallback for browsers without dialog support
      dialog.setAttribute('open', '');
      dialog.style.display = 'block';
      // Add backdrop and focus management manually
    }
  };
</script>`;
                  }
                  return null;
                default:
                  // For unknown features, generate a basic feature detection pattern
                  const featureParts = featureId.split("-");
                  const featureName =
                    featureParts.length > 1
                      ? featureParts
                          .map((p, i) =>
                            i > 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p
                          )
                          .join("")
                      : featureId;

                  return null;
              }
            };

            // Helper function for feature detection code
            const getFeatureDetectionCode = (featureId: string) => {
              const parts = featureId.split("-");

              // Common patterns for API detection
              if (featureId.startsWith("navigator-")) {
                const prop = parts[1];
                return `'${prop}' in navigator`;
              }

              if (featureId.startsWith("document-")) {
                const prop = parts[1];
                return `'${prop}' in document`;
              }

              if (featureId.startsWith("window-")) {
                const prop = parts[1];
                return `'${prop}' in window`;
              }

              // Default with cautious checks
              return `typeof ${parts[0]} !== 'undefined' && '${parts.slice(1).join("-")}' in ${parts[0]}`;
            };

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
                let featureId = f.featureId || String(f.code || "");
                const suggestion = (f as any).suggestion as string | undefined;
                const title = f.title || "";

                // Map feature ID to the correct ID for guard code generation
                // Log feature details for debugging
                console.log("Feature details:", {
                  id: featureId,
                  title: title,
                  file: doc.fileName,
                  line: f.line,
                  column: f.column,
                });

                // Special case mappings based on feature ID or title
                if (
                  featureId === "url-canparse" ||
                  featureId.includes("url.canparse") ||
                  title.includes("URL.canParse")
                ) {
                  featureId = "url-canparse";
                  console.log("✅ Mapped to url-canparse");
                }
                // Force detection for URL.canParse based on suggestion text
                else if (
                  suggestion &&
                  suggestion.includes("URL") &&
                  suggestion.includes("validation")
                ) {
                  featureId = "url-canparse";
                  console.log(
                    "🔍 Forced detection of URL.canParse from suggestion"
                  );
                }

                if (
                  featureId === "navigator-share" ||
                  featureId.includes("navigator.share") ||
                  title.includes("Web Share API") ||
                  title.includes("navigator.share")
                ) {
                  featureId = "navigator-share";
                  console.log("✅ Mapped to navigator-share");
                }
                // Force detection for navigator.share based on suggestion or code context
                else if (
                  (suggestion && suggestion.toLowerCase().includes("share")) ||
                  (f.code && String(f.code).includes("share"))
                ) {
                  featureId = "navigator-share";
                  console.log(
                    "🔍 Forced detection of navigator.share from context"
                  );
                }

                // Try to generate actual implementation code first
                // Try to get guard code with exact ID match first
                let guardCode = generateGuardCode(
                  featureId,
                  suggestion,
                  doc.languageId
                );

                // If no match, try some common variations
                if (!guardCode) {
                  // For URL.canParse
                  if (f.title && f.title.includes("URL.canParse")) {
                    guardCode = generateGuardCode(
                      "url-canparse",
                      suggestion,
                      doc.languageId
                    );
                  }
                  // For navigator.share
                  else if (
                    f.title &&
                    (f.title.includes("navigator.share") ||
                      f.title.includes("Web Share"))
                  ) {
                    guardCode = generateGuardCode(
                      "navigator-share",
                      suggestion,
                      doc.languageId
                    );
                  }
                }

                // Log what we're using
                console.log(
                  `Using feature ID: ${featureId}, Found guard code: ${!!guardCode}`
                );

                // If we have specific code for this feature, use it
                if (guardCode) {
                  return {
                    line: f.line,
                    column: f.column,
                    insertText: guardCode + "\n",
                  };
                }

                // Fall back to comment-based suggestion if no specific implementation
                const body = suggestion
                  ? `Suggestion: ${suggestion}`
                  : f.docsUrl
                    ? `See docs: ${f.docsUrl}`
                    : `Consider guards or a fallback for ${featureId}`;

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
