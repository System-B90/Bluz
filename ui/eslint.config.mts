import stylistic from "@stylistic/eslint-plugin";
import nextConfig from "eslint-config-next/core-web-vitals";
import importPlugin from "eslint-plugin-import";
import perfectionist from "eslint-plugin-perfectionist";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig } from "eslint/config";
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
        project: true,
      },
    },
    settings: {
      next: { rootDir: "ui/" },
    },
    rules: {
      // --- General Formatting ---
      "eol-last": ["error", "always"],
      "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],

      // --- Variables & Imports ---
      "no-unused-vars": "off",
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
      "unused-imports/no-unused-imports": "error",
      
      // Force Absolute Imports
      "no-restricted-imports": ["error", { patterns: ["./*", "../*"] }],

      // Sorted & Spaced Imports
      "import/order": [
        "error",
        {
          "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          "alphabetize": { order: "asc", caseInsensitive: true }
        }
      ],

      // --- Structural Spacing (Unified Stylistic) ---
      "@stylistic/padding-line-between-statements": [
        "error",
        // Interface: Newline before and after
        { blankLine: "always", prev: "interface", next: "*" },
        { blankLine: "always", prev: "*", next: "interface" },
        // Function: Newline between functions
        { blankLine: "always", prev: "function", next: "function" },
        // Type: No newline between consecutive type definitions
        { blankLine: "never", prev: "type", next: "type" },
        // Import: Ensure space after import block
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
      ],

      // --- Function/Destructuring Formatting ---
      "object-curly-newline": ["error", { 
        "ObjectPattern": { "multiline": true, "consistent": true } 
      }],
      "object-property-newline": ["error", { 
        "allowAllPropertiesOnSameLine": true 
      }],
    },
  },
  {
    ignores: [
      ".next/*", "out/*", "dist/*",
      "ui/.next/*", "ui/out/*", "ui/dist/*",
    ],
  },
]);