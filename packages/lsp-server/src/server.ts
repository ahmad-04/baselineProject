/* Minimal LSP-like server skeleton (stdio). Real LSP wiring will follow. */
import { analyze, type FileRef, type Finding } from "@whoisahmad/baseline-tools-core";

type Message = {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: any;
};

function analyzeText(uri: string, text: string, targets?: string[]): Finding[] {
  const files: FileRef[] = [{ path: uri, content: text }];
  return analyze(files, { targets });
}

function write(msg: any) {
  const s = JSON.stringify(msg);
  process.stdout.write(
    `Content-Length: ${Buffer.byteLength(s, "utf8")}\r\n\r\n${s}`
  );
}

process.stdin.on("readable", () => {
  // NOTE: This is a placeholder, not a full LSP implementation.
  let chunk;
  while ((chunk = process.stdin.read())) {
    const str = chunk.toString("utf8");
    // Very naive: find JSON body after header
    const idx = str.indexOf("\r\n\r\n");
    const body = idx >= 0 ? str.slice(idx + 4) : str;
    try {
      const msg = JSON.parse(body) as Message;
      if (msg.method === "initialize") {
        write({ jsonrpc: "2.0", id: msg.id, result: { capabilities: {} } });
      } else if (msg.method === "textDocument/didOpen") {
        // noop in skeleton
      } else if (msg.method === "baseline/analyzeText") {
        const { uri, text, targets } = msg.params ?? {};
        const findings = analyzeText(uri, text, targets);
        write({ jsonrpc: "2.0", id: msg.id, result: { findings } });
      } else if (msg.method === "baseline/fixAll") {
        const { uri, text, language, targets } = msg.params ?? {};
        const findings = analyzeText(uri, text, targets);
        const wrap = (body: string) => {
          if (language === "html") return `<!-- ${body} -->`;
          if (language === "css") return `/* ${body} */`;
          return `// ${body}`;
        };
        const edits = findings
          .filter(
            (f) =>
              (f as any).advice !== "guarded" && (f as any).baseline !== "yes"
          )
          .map((f) => {
            const s = (f as any).suggestion as string | undefined;
            const body = s
              ? `Suggestion: ${s}`
              : (f as any).docsUrl
                ? `See docs: ${(f as any).docsUrl}`
                : `Consider guards or a fallback`;
            return {
              line: (f as any).line,
              column: (f as any).column,
              insertText: wrap(body) + "\n",
            };
          });
        write({ jsonrpc: "2.0", id: msg.id, result: { edits } });
      } else if (msg.id !== undefined) {
        write({ jsonrpc: "2.0", id: msg.id, result: null });
      }
    } catch {
      // ignore malformed input in skeleton
    }
  }
});
