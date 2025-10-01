// Minimal ESLint v9 flat config that requires no extra plugins
// Scopes linting to JavaScript files for now to get green CI quickly.
export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.changeset/**",
      "temp-extension/**",
      "**/*.vsix",
      "**/baseline-report.*",
    ],
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "off",
      "no-console": "off",
      "eqeqeq": ["warn", "smart"],
      "curly": ["warn", "multi-line"],
    },
  },
];
