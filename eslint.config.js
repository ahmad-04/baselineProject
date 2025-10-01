// ESLint v9 flat config with optional TypeScript support.
// 
// Locally (where extra devDeps might not be installed), this gracefully
// falls back to JS-only rules. In CI, with devDeps installed, it enables
// typescript-eslint with type-aware rules.

export default (async () => {
  const baseIgnore = {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.changeset/**",
      "temp-extension/**",
      "**/*.vsix",
      "**/baseline-report.*",
    ],
  };

  const configs = [baseIgnore];

  // Try to include @eslint/js recommended config
  try {
    const js = await import("@eslint/js");
    configs.push(js.configs.recommended);
  } catch {
    // Fallback handled by explicit JS block below
  }

  // Try to include typescript-eslint recommended (type-checked)
  let hasTs = false;
  try {
    const tseslint = await import("typescript-eslint");
    configs.push(...tseslint.configs.recommendedTypeChecked);
    configs.push({
      files: ["**/*.ts", "**/*.tsx"],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: new URL(".", import.meta.url),
        },
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        "no-console": "off",
        eqeqeq: ["warn", "smart"],
        curly: ["warn", "multi-line"],
      },
    });
    hasTs = true;
  } catch {
    // No TS config available locally; keep JS-only
  }

  // Always include a pragmatic JS ruleset
  configs.push({
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "off",
      "no-console": "off",
      eqeqeq: ["warn", "smart"],
      curly: ["warn", "multi-line"],
    },
  });

  return configs;
})();
