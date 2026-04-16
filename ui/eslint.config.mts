import stylistic from "@stylistic/eslint-plugin";
import { defineConfig } from "eslint/config";
import nextConfig from "eslint-config-next/core-web-vitals";
import importPlugin from "eslint-plugin-import";
import perfectionist from "eslint-plugin-perfectionist";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default defineConfig([
  nextConfig,
  {
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "@stylistic": stylistic,
      "import": importPlugin,
      "unused-imports": unusedImports,
      "perfectionist": perfectionist,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Use projectService for better performance and automatic TSConfig matching
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      next: { rootDir: "ui/" },
    },
    rules: {
      "eol-last": [ "error", "always" ],
      "no-multiple-empty-lines": [ "error", { max: 1, maxEOF: 0 } ],

      // --- Variables & Imports ---
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],
      "unused-imports/no-unused-imports": "error",

      // Force Absolute Imports - EXCEPT for Next.js internals
      "no-restricted-imports": [ "error", {
        patterns: [
          {
            group: [ "./*", "../*" ],
            message: "Relative imports are not allowed. Use absolute paths.",
            // Allow Next.js internal type-safe route files
            allowTypeImports: true
          }
        ]
      } ],

      "import/order": [
        "error",
        {
          "groups": [ "builtin", "external", "internal", "parent", "sibling", "index" ],
          "newlines-between": "always",
          "alphabetize": { order: "asc", caseInsensitive: true }
        }
      ],

      // --- Structural Spacing ---
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "interface", next: "*" },
        { blankLine: "always", prev: "*", next: "interface" },
        { blankLine: "always", prev: "function", next: "function" },
        { blankLine: "never", prev: "type", next: "type" },
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
      ],

      "object-curly-newline": [ "error", { "ObjectPattern": { "multiline": true, "consistent": true } } ],
      "object-property-newline": [ "error", { "allowAllPropertiesOnSameLine": true } ],
    },
  },
  // Disable type-aware linting for config files to prevent TSConfig mismatches
  {
    files: [ "**/*.js", "**/*.mjs", "**/*.mts" ],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: [
      ".next/*", "out/*", "dist/*",
      "ui/.next/*", "ui/out/*", "ui/dist/*",
      "node_modules/*",
      "next-env.d.ts",
    ],
  },
]);
