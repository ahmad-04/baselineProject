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
    hasSuggestions: true,
    messages: {
      nonBaseline:
        "{{title}} may not be Baseline for your targets. See: {{docsUrl}}",
      suggestShareGuard:
        "Wrap navigator.share in a capability check with a fallback",
      suggestUrlParseFallback:
        "Use try/catch with new URL(...) instead of URL.canParse",
      suggestViewTransitionGuard:
        "Guard document.startViewTransition with a feature check",
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
            const loc = {
              start: { line: f.line, column: f.column - 1 },
              end: { line: f.line, column: f.column },
            } as const;
            const suggestions: Rule.SuggestionReportDescriptor[] = [];
            if (f.featureId === "navigator-share") {
              suggestions.push({
                messageId: "suggestShareGuard",
                fix(fixer) {
                  // Non-destructive: insert a guard template comment above the line
                  const index = source.getIndexFromLoc(loc.start);
                  const text = `// Suggestion: if (navigator.share) { /* await navigator.share({...}) */ } else { /* fallback */ }\n`;
                  return fixer.insertTextBeforeRange([index, index], text);
                },
              });
            }
            if (f.featureId === "url-canparse") {
              suggestions.push({
                messageId: "suggestUrlParseFallback",
                fix(fixer) {
                  const index = source.getIndexFromLoc(loc.start);
                  const text = `// Suggestion: function canParse(u){ try { new URL(u); return true; } catch { return false; } }\n`;
                  return fixer.insertTextBeforeRange([index, index], text);
                },
              });
            }
            if (f.featureId === "view-transitions") {
              suggestions.push({
                messageId: "suggestViewTransitionGuard",
                fix(fixer) {
                  const index = source.getIndexFromLoc(loc.start);
                  const text = `// Suggestion: if ('startViewTransition' in document) { /* ... */ } else { /* fallback */ }\n`;
                  return fixer.insertTextBeforeRange([index, index], text);
                },
              });
            }
            context.report({
              loc,
              messageId: "nonBaseline",
              data: { title: f.title, docsUrl: f.docsUrl },
              suggest: suggestions,
            });
          }
        }
      },
    };
  },
};

export default rule;
