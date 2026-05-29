import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", "**/*.tsbuildinfo"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Stack requirement (CLAUDE.md): no default exports in source/test code.
    // Build tooling (eslint.config.js, *.config.ts) is exempt — those formats
    // require a default export.
    files: ["packages/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Default exports are banned (CLAUDE.md stack rule). Use named exports.",
        },
      ],
    },
  },
);
