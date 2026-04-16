import stylistic from "@stylistic/eslint-plugin";
import { defineConfig } from "eslint/config";
import nextConfig from "eslint-config-next/core-web-vitals";
import importPlugin from "eslint-plugin-import";
import perfectionist from "eslint-plugin-perfectionist";
import reactPlugin from "eslint-plugin-react";
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
      "react": reactPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
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

      // --- Variables, Types & Assertions ---
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/method-signature-style": [ "error", "property" ],
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" }
      ],
      "@typescript-eslint/no-floating-promises": "error",

      // --- Exports & Imports ---
      "import/no-default-export": "error",
      "import/no-cycle": "error",
      "unused-imports/no-unused-imports": "error",
      "no-restricted-imports": [ "error", {
        patterns: [ { group: [ "./*", "../*" ], message: "Use absolute paths.", allowTypeImports: true } ]
      } ],
      "import/order": [
        "error",
        {
          "groups": [ "builtin", "external", "internal", "parent", "sibling", "index" ],
          "newlines-between": "always",
          "alphabetize": { order: "asc", caseInsensitive: true }
        }
      ],

      // --- React & Perfectionist ---
      "react/jsx-no-leaked-render": [ "error", { validStrategies: [ "ternary", "coerce" ] } ],
      "perfectionist/sort-variable-declarations": [ "error", { type: "alphabetical" } ],
      "perfectionist/sort-union-types": [ "error", { type: "alphabetical" } ],
      "perfectionist/sort-jsx-props": [ "error", { type: "alphabetical" } ],

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
  {
    files: [ "**/app/**/{page,layout,error,not-found,loading,template,default}.tsx", "**/app/**/route.ts" ],
    rules: { "import/no-default-export": "off" },
  },
  {
    files: [ "**/*.js", "**/*.mjs", "**/*.mts" ],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: [ ".next/*", "out/*", "dist/*", "ui/.next/*", "ui/out/*", "ui/dist/*", "node_modules/*", "ui/next-env.d.ts" ],
  },
]);
