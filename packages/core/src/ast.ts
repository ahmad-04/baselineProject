import { parse } from "@typescript-eslint/typescript-estree";

export interface AstFindingCandidate {
  featureId: string;
  title: string;
  docs: string;
  baseline: "yes" | "no" | "partial";
  suggestion?: string;
  line: number;
  column: number;
  guarded?: boolean;
}

export function tryDetectJsAst(
  code: string,
  filename: string
): AstFindingCandidate[] | null {
  try {
    const ast = parse(code, {
      loc: true,
      range: true,
      comment: false,
      jsx: filename.endsWith(".jsx") || filename.endsWith(".tsx"),
      errorOnUnknownASTType: false,
      ecmaVersion: 2022,
      sourceType: "module",
    });

    const out: AstFindingCandidate[] = [];

    attachParents(ast);

    // Prepass: collect identifiers that alias URLPattern
    const urlPatternAliases = collectUrlPatternAliases(ast);

    function push(
      featureId: string,
      title: string,
      docs: string,
      baseline: "yes" | "no" | "partial",
      node: any,
      suggestion?: string,
      guarded?: boolean
    ) {
      const loc = node.loc || { start: { line: 1, column: 0 } };
      out.push({
        featureId,
        title,
        docs,
        baseline,
        suggestion,
        line: loc.start.line,
        column: (loc.start.column || 0) + 1,
        guarded,
      });
    }

    // Minimal walker to avoid bringing a full traversal dependency
    const stack: any[] = [ast];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node.type !== "string") continue;

      // navigator.clipboard.* (readText, writeText, read, write)
      if (
        node.type === "CallExpression" &&
        node.callee?.type === "MemberExpression" &&
        node.callee.property?.type === "Identifier" &&
        ["readText", "writeText", "read", "write"].includes(
          node.callee.property.name
        ) &&
        node.callee.object?.type === "MemberExpression" &&
        node.callee.object.property?.type === "Identifier" &&
        node.callee.object.property.name === "clipboard" &&
        ((node.callee.object.object?.type === "Identifier" &&
          node.callee.object.object.name === "navigator") ||
          (node.callee.object.object?.type === "MemberExpression" &&
            node.callee.object.object.object?.type === "Identifier" &&
            node.callee.object.object.object.name === "window" &&
            node.callee.object.object.property?.type === "Identifier" &&
            node.callee.object.object.property.name === "navigator"))
      ) {
        push(
          "async-clipboard",
          "Async Clipboard API",
          "https://developer.mozilla.org/docs/Web/API/Clipboard_API",
          "partial",
          node,
          "Guard: if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(...) } else { /* fallback */ }",
          isGuardedByIfCheck(
            node,
            (cond: any) =>
              containsNavigatorClipboard(cond) ||
              containsNavigatorClipboardWrite(cond)
          )
        );
      }

      // structuredClone(...)
      if (
        node.type === "CallExpression" &&
        node.callee?.type === "Identifier" &&
        node.callee.name === "structuredClone"
      ) {
        push(
          "structured-clone",
          "structuredClone()",
          "https://developer.mozilla.org/docs/Web/API/structuredClone",
          "yes",
          node,
          "Prefer structuredClone over deep-clone utilities; guard if targeting older browsers."
        );
      }

      // Array.prototype.at(...)
      if (
        node.type === "CallExpression" &&
        node.callee?.type === "MemberExpression" &&
        node.callee.property?.type === "Identifier" &&
        node.callee.property.name === "at"
      ) {
        push(
          "array-prototype-at",
          "Array.prototype.at()",
          "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/at",
          "partial",
          node,
          "Fallback: use arr[index >= 0 ? index : arr.length + index] for negatives."
        );
      }

      // Promise.any(...)
      if (
        node.type === "CallExpression" &&
        node.callee?.type === "MemberExpression" &&
        node.callee.object?.type === "Identifier" &&
        node.callee.object.name === "Promise" &&
        node.callee.property?.type === "Identifier" &&
        node.callee.property.name === "any"
      ) {
        push(
          "promise-any",
          "Promise.any()",
          "https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/any",
          "partial",
          node,
          "Fallback: emulate with Promise.race on wrapped promises or a small polyfill."
        );
      }

      // new URLPattern(...) including window.URLPattern/globalThis.URLPattern and aliased bindings
      if (
        node.type === "NewExpression" &&
        ((node.callee?.type === "Identifier" &&
          node.callee.name === "URLPattern") ||
          (node.callee?.type === "MemberExpression" &&
            node.callee.property?.type === "Identifier" &&
            node.callee.property.name === "URLPattern") ||
          // Handle identifier binding e.g., const P = URLPattern; new P(...)
          (node.callee?.type === "Identifier" &&
            urlPatternAliases.has(node.callee.name)))
      ) {
        push(
          "urlpattern",
          "URLPattern",
          "https://developer.mozilla.org/docs/Web/API/URL_Pattern_API",
          "partial",
          node,
          "Fallback: use the urlpattern-polyfill or Regex-based matching."
        );
      }

      // navigator.share(...)
      if (
        node.type === "CallExpression" &&
        node.callee &&
        ((node.callee.type === "MemberExpression" &&
          node.callee.property?.type === "Identifier" &&
          node.callee.property.name === "share" &&
          // object: navigator or window.navigator
          ((node.callee.object?.type === "Identifier" &&
            node.callee.object.name === "navigator") ||
            (node.callee.object?.type === "MemberExpression" &&
              node.callee.object.object?.type === "Identifier" &&
              node.callee.object.object.name === "window" &&
              node.callee.object.property?.type === "Identifier" &&
              node.callee.object.property.name === "navigator"))) ||
          (node.callee.type === "OptionalMemberExpression" &&
            node.callee.property?.type === "Identifier" &&
            node.callee.property.name === "share"))
      ) {
        push(
          "navigator-share",
          "Web Share API",
          "https://developer.mozilla.org/docs/Web/API/Navigator/share",
          "partial",
          node,
          "Guard: if (navigator.share) { await navigator.share(...) } else { fallback }",
          isGuardedByIfCheck(node, (cond: any) => containsNavigatorShare(cond))
        );
      }

      // URL.canParse(...)
      if (
        node.type === "CallExpression" &&
        node.callee?.type === "MemberExpression" &&
        node.callee.object?.type === "Identifier" &&
        node.callee.object.name === "URL" &&
        node.callee.property?.type === "Identifier" &&
        node.callee.property.name === "canParse"
      ) {
        push(
          "url-canparse",
          "URL.canParse()",
          "https://developer.mozilla.org/docs/Web/API/URL/canParse_static",
          "partial",
          node,
          "Fallback: try/catch new URL(...) for validation.",
          isGuardedByIfCheck(node, (cond: any) => containsUrlCanParse(cond))
        );
      }

      // document.startViewTransition(...)
      if (
        node.type === "CallExpression" &&
        node.callee?.type === "MemberExpression" &&
        node.callee.object?.type === "Identifier" &&
        node.callee.object.name === "document" &&
        node.callee.property?.type === "Identifier" &&
        node.callee.property.name === "startViewTransition"
      ) {
        push(
          "view-transitions",
          "View Transitions API",
          "https://developer.mozilla.org/docs/Web/API/Document/startViewTransition",
          "partial",
          node,
          "Guard: if ('startViewTransition' in document) { ... } else { ... }",
          isGuardedByIfCheck(node, (cond: any) =>
            containsInExpression(cond, "startViewTransition", "document")
          )
        );
      }

      // window.showOpenFilePicker(...)
      if (
        node.type === "CallExpression" &&
        node.callee?.type === "Identifier" &&
        node.callee.name === "showOpenFilePicker"
      ) {
        push(
          "file-system-access-picker",
          "showOpenFilePicker()",
          "https://developer.mozilla.org/docs/Web/API/window/showOpenFilePicker",
          "partial",
          node,
          'Fallback: use <input type="file"> when picker is unavailable.',
          isGuardedByIfCheck(node, (cond: any) =>
            containsIdentifier(cond, "showOpenFilePicker")
          )
        );
      }

      // dialog.showModal() — treat as dialog feature usage for guidance
      if (
        node.type === "CallExpression" &&
        node.callee?.type === "MemberExpression" &&
        node.callee.property?.type === "Identifier" &&
        node.callee.property.name === "showModal"
      ) {
        push(
          "html-dialog",
          "<dialog> element",
          "https://developer.mozilla.org/docs/Web/HTML/Element/dialog",
          "partial",
          node,
          "Provide a dialog polyfill or non-modal fallback; ensure focus management and escape handling.",
          isGuardedByIfCheck(node, (cond: any) =>
            containsIdentifier(cond, "showModal")
          )
        );
      }

      // Queue children (skip synthetic parent links to avoid cycles)
      for (const key of Object.keys(node)) {
        if (key === "parent") continue;
        const val = (node as any)[key];
        if (val && typeof val === "object") {
          if (Array.isArray(val)) {
            for (let i = val.length - 1; i >= 0; i--) stack.push(val[i]);
          } else {
            stack.push(val);
          }
        }
      }
    }

    return out;
  } catch {
    return null;
  }
}

function isGuardedByIfCheck(
  node: any,
  predicate: (cond: any) => boolean
): boolean {
  // Walk up parents to find an IfStatement containing this node
  let cur: any = node;
  while (cur && cur.parent) {
    if (cur.parent.type === "IfStatement") {
      const cond = cur.parent.test;
      if (predicate(cond)) return true;
    }
    cur = cur.parent;
  }
  return false;
}

function collectUrlPatternAliases(root: any): Set<string> {
  const aliases = new Set<string>();
  const stack: any[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node.type !== "string") continue;
    // const P = URLPattern;  OR  const P = window.URLPattern
    if (
      node.type === "VariableDeclarator" &&
      node.id?.type === "Identifier" &&
      ((node.init?.type === "Identifier" && node.init.name === "URLPattern") ||
        (node.init?.type === "MemberExpression" &&
          node.init.property?.type === "Identifier" &&
          node.init.property.name === "URLPattern"))
    ) {
      aliases.add(node.id.name);
    }
    // P = URLPattern;
    if (
      node.type === "AssignmentExpression" &&
      node.left?.type === "Identifier" &&
      ((node.right?.type === "Identifier" &&
        node.right.name === "URLPattern") ||
        (node.right?.type === "MemberExpression" &&
          node.right.property?.type === "Identifier" &&
          node.right.property.name === "URLPattern"))
    ) {
      aliases.add(node.left.name);
    }
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const val = (node as any)[key];
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = val.length - 1; i >= 0; i--) stack.push(val[i]);
        } else stack.push(val);
      }
    }
  }
  return aliases;
}

function attachParents(root: any) {
  const stack: any[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const val = (node as any)[key];
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (const el of val) {
            if (el && typeof el === "object" && !el.parent) el.parent = node;
            stack.push(el);
          }
        } else {
          if (!val.parent) val.parent = node;
          stack.push(val);
        }
      }
    }
  }
}

function containsNavigatorShare(node: any): boolean {
  // navigator.share presence in condition
  if (!node || typeof node !== "object") return false;
  if (
    node.type === "MemberExpression" &&
    node.property?.type === "Identifier" &&
    node.property.name === "share" &&
    ((node.object?.type === "Identifier" && node.object.name === "navigator") ||
      (node.object?.type === "MemberExpression" &&
        node.object.object?.type === "Identifier" &&
        node.object.object.name === "window" &&
        node.object.property?.type === "Identifier" &&
        node.object.property.name === "navigator"))
  )
    return true;
  return scanChildren(node, containsNavigatorShare);
}

function containsUrlCanParse(node: any): boolean {
  if (!node || typeof node !== "object") return false;
  if (
    node.type === "MemberExpression" &&
    node.object?.type === "Identifier" &&
    node.object.name === "URL" &&
    node.property?.type === "Identifier" &&
    node.property.name === "canParse"
  )
    return true;
  return scanChildren(node, containsUrlCanParse);
}

function containsInExpression(
  node: any,
  prop: string,
  objName: string
): boolean {
  if (!node || typeof node !== "object") return false;
  if (
    node.type === "BinaryExpression" &&
    node.operator === "in" &&
    ((node.right?.type === "Identifier" && node.right.name === objName) ||
      (node.right?.type === "MemberExpression" &&
        node.right.object?.name === objName)) &&
    ((node.left?.type === "Literal" && node.left.value === prop) ||
      (node.left?.type === "Identifier" && node.left.name === prop))
  )
    return true;
  return scanChildren(node, (n) => containsInExpression(n, prop, objName));
}

function containsIdentifier(node: any, name: string): boolean {
  if (!node || typeof node !== "object") return false;
  if (node.type === "Identifier" && node.name === name) return true;
  return scanChildren(node, (n) => containsIdentifier(n, name));
}

function scanChildren(node: any, fn: (n: any) => boolean): boolean {
  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const val = (node as any)[key];
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (const el of val) {
          if (fn(el)) return true;
        }
      } else if (fn(val)) return true;
    }
  }
  return false;
}

function containsNavigatorClipboard(node: any): boolean {
  if (!node || typeof node !== "object") return false;
  if (node.type === "ChainExpression") {
    return containsNavigatorClipboard(node.expression);
  }
  if (
    node.type === "OptionalMemberExpression" &&
    node.object &&
    containsNavigatorClipboard(node.object)
  )
    return true;
  if (
    node.type === "MemberExpression" &&
    node.property?.type === "Identifier" &&
    node.property.name === "clipboard" &&
    ((node.object?.type === "Identifier" && node.object.name === "navigator") ||
      (node.object?.type === "MemberExpression" &&
        node.object.object?.type === "Identifier" &&
        node.object.object.name === "window" &&
        node.object.property?.type === "Identifier" &&
        node.object.property.name === "navigator"))
  )
    return true;
  return scanChildren(node, containsNavigatorClipboard);
}

function containsNavigatorClipboardWrite(node: any): boolean {
  if (!node || typeof node !== "object") return false;
  if (node.type === "ChainExpression")
    return containsNavigatorClipboardWrite(node.expression);
  if (node.type === "OptionalMemberExpression") {
    // Direct optional access: navigator.clipboard?.writeText
    if (
      node.property?.type === "Identifier" &&
      node.property.name === "writeText" &&
      containsNavigatorClipboard(node.object)
    ) {
      return true;
    }
    // Recurse into object (e.g., optional on earlier chain step)
    if (node.object && containsNavigatorClipboardWrite(node.object))
      return true;
  }
  if (
    node.type === "MemberExpression" &&
    node.property?.type === "Identifier" &&
    node.property.name === "writeText" &&
    node.object &&
    containsNavigatorClipboard(node.object)
  )
    return true;
  return scanChildren(node, containsNavigatorClipboardWrite);
}
