// ESLint flat config for ESLint v9+
import tsParser from "@typescript-eslint/parser";
import baselinePlugin from "../../packages/eslint-plugin-baseline/dist/index.js";

export default [
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    plugins: {
      baseline: baselinePlugin,
    },
    rules: {
      "baseline/no-nonbaseline": "warn",
    },
  },
];
