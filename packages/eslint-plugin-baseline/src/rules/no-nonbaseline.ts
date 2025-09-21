import type { Rule } from "eslint";
import type { SourceCode } from "eslint";
import { analyze, type FileRef } from "@baseline-tools/core";
import fs from "node:fs";
import path from "node:path";

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
      nonBaseline: "{{title}} — {{advice}}. See: {{docsUrl}}",
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
        type BaselineConfig = {
          targets?: string[] | string;
          unsupportedThreshold?: number;
          features?: Record<string, boolean>;
        };
        function loadConfig(start: string): BaselineConfig | undefined {
          let dir = path.dirname(start);
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
        function loadTargetsFromNearestPackage(
          start: string
        ): string[] | undefined {
          let dir = path.dirname(start);
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
              // ignore and continue up
            }
            if (dir === root) break;
            const next = path.dirname(dir);
            if (next === dir) break;
            dir = next;
          }
          return undefined;
        }
        const cfg = loadConfig(filePath);
        const cfgTargets = Array.isArray(cfg?.targets)
          ? (cfg?.targets as string[])
          : typeof cfg?.targets === "string"
            ? [cfg?.targets as string]
            : undefined;
        const targets = cfgTargets ?? loadTargetsFromNearestPackage(filePath);
        const res = analyze(
          [{ path: filePath, content: source.text } satisfies FileRef],
          { targets }
        );
        for (const f of res) {
          if (cfg?.features && cfg.features[f.featureId] === false) continue;
          if (f.baseline !== "yes" && !(f as any).guarded) {
            // Apply unsupported-threshold to soften advice
            const threshold = cfg?.unsupportedThreshold;
            const advice = ((): string => {
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
            const adv = advice as string | undefined;
            const adviceLabel =
              adv === "needs-guard"
                ? "Needs guard"
                : adv === "guarded"
                  ? "Guarded"
                  : adv === "safe"
                    ? "Safe to adopt"
                    : "Needs guard";
            context.report({
              loc,
              messageId: "nonBaseline",
              data: {
                title: f.title,
                docsUrl: f.docsUrl,
                advice: adviceLabel,
              },
              suggest: suggestions,
            });
          }
        }
      },
    };
  },
};

export default rule;
