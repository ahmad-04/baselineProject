import type { Rule } from "eslint";
import type { SourceCode } from "eslint";
import { analyze, type FileRef } from "@baseline-tools/core";

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Warn when code uses features that are not Baseline for the configured targets",
      recommended: true,
    },
    schema: [],
    messages: {
      nonBaseline:
        "{{title}} may not be Baseline for your targets. See: {{docsUrl}}",
    },
  },
  create(context) {
    return {
      Program() {
        const source: SourceCode = context.getSourceCode();
        const filePath = context.getFilename();
        const res = analyze(
          [{ path: filePath, content: source.text } satisfies FileRef],
          {}
        );
        for (const f of res) {
          if (f.baseline !== "yes") {
            context.report({
              loc: {
                start: { line: f.line, column: f.column - 1 },
                end: { line: f.line, column: f.column },
              },
              messageId: "nonBaseline",
              data: { title: f.title, docsUrl: f.docsUrl },
            });
          }
        }
      },
    };
  },
};

export default rule;
