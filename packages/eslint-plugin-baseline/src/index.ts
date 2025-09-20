import type { Rule } from "eslint";
import noNonbaseline from "./rules/no-nonbaseline.js";

const rules: Record<string, Rule.RuleModule> = {
  "no-nonbaseline": noNonbaseline,
};

const plugin = {
  rules,
  configs: {
    recommended: {
      rules: {
        "baseline/no-nonbaseline": "warn",
      },
    },
  },
};

export default plugin;
