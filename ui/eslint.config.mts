import { dirname } from "path";
import { fileURLToPath } from "url";

import { defineConfig } from "eslint/config";
import nextConfig from "eslint-config-next/core-web-vitals";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig([
  nextConfig,
  {
    plugins: {
      "import": importPlugin,
      "unused-imports": unusedImports,
    },
    settings: {
      next: {
        rootDir: "ui/",
      },
    },
    rules: {
      // --- General Formatting ---
      "eol-last": [ "error", "always" ],               // File ends in newline
      "no-multiple-empty-lines": [ "error", {
        max: 1,
        maxEOF: 0
      } ],                                            // Max 1 consecutive blank line

      // --- Variables ---
      "@typescript-eslint/no-explicit-any": "off",
      "no-unused-vars": "off",                       // Handled by unused-imports
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_"
        },
      ],

      // --- Import Management ---
      "unused-imports/no-unused-imports": "error",   // No unused imports
      "import/order": [
        "error",
        {
          "groups": [ "builtin", "external", "internal", "parent", "sibling", "index" ],
          "newlines-between": "always",              // Blankline after import block
          "alphabetize": { order: "asc", caseInsensitive: true }
        }
      ],

      // --- Function Spacing ---
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "function", next: "function" },
      ],
    },
  },
  {
    ignores: [
      ".next/*", "out/*", "dist/*",
      "ui/.next/*", "ui/out/*", "ui/dist/*",
    ],
  },
]);
