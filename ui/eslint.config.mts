import stylistic from "@stylistic/eslint-plugin";
import { defineConfig } from "eslint/config";
import nextConfig from "eslint-config-next/core-web-vitals";
import importPlugin from "eslint-plugin-import";
import perfectionist from "eslint-plugin-perfectionist";
import reactPlugin from "eslint-plugin-react";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default defineConfig([
    nextConfig,
    {
        plugins: {
            "@typescript-eslint": tseslint.plugin,
            "@stylistic": stylistic,
            import: importPlugin,
            "unused-imports": unusedImports,
            perfectionist: perfectionist,
            react: reactPlugin,
            unicorn: unicorn,
        },
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: {
                    allowDefaultProject: [
                        "../playwright.config.ts",
                        "../tests/*.ts",
                        "../tests/*.tsx",
                    ],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
        settings: {
            next: { rootDir: "ui/" },
        },
        rules: {
            "eol-last": ["error", "always"],
            "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],
            indent: ["error", 4],

            // --- Variables, Types & Assertions ---
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/method-signature-style": ["error", "property"],
            // "@typescript-eslint/consistent-type-assertions": [
            //   "error",
            //   { assertionStyle: "as", objectLiteralTypeAssertions: "allow-as-parameter" }
            // ],
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/array-type": ["error", { default: "generic" }],
            "@typescript-eslint/consistent-type-definitions": ["error", "type"],
            "@typescript-eslint/no-base-to-string": "error",
            "@typescript-eslint/ban-tslint-comment": "error",
            "@typescript-eslint/no-for-in-array": "error", // Use "of" instead
            "@typescript-eslint/prefer-for-of": "error",
            "@typescript-eslint/prefer-includes": "error",
            "@typescript-eslint/return-await": ["error", "always"],
            "@typescript-eslint/adjacent-overload-signatures": "error",
            "@typescript-eslint/ban-ts-comment": [
                "error",
                { "ts-ignore": "allow-with-description" },
            ],

            // --- Exports & Imports ---
            "import/no-default-export": "error",
            "import/no-cycle": "error",
            "unused-imports/no-unused-imports": "error",
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["./*", "../*"],
                            message: "Use absolute paths.",
                            allowTypeImports: true,
                        },
                        {
                            regex: "^@mui/[^/]+$",
                        },
                    ],
                },
            ],
            "import/order": [
                "error",
                {
                    groups: [
                        "builtin",
                        "external",
                        "internal",
                        "parent",
                        "sibling",
                        "index",
                    ],
                    "newlines-between": "always",
                    alphabetize: { order: "asc", caseInsensitive: true },
                },
            ],
            "@typescript-eslint/consistent-type-exports": [
                "error",
                { fixMixedExportsWithInlineTypeSpecifier: true },
            ],

            // --- React & Perfectionist ---
            "react/jsx-no-leaked-render": [
                "error",
                { validStrategies: ["ternary", "coerce"] },
            ],
            "perfectionist/sort-variable-declarations": [
                "error",
                { type: "alphabetical" },
            ],
            "perfectionist/sort-union-types": [
                "error",
                { type: "alphabetical" },
            ],
            "perfectionist/sort-jsx-props": ["error", { type: "alphabetical" }],

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

            "object-curly-newline": [
                "error",
                { ObjectPattern: { multiline: true, consistent: true } },
            ],
            "object-property-newline": [
                "error",
                { allowAllPropertiesOnSameLine: true },
            ],

            // --- Filename Convention (Unicorn) ---
            "unicorn/filename-case": [
                "error",
                {
                    cases: {
                        kebabCase: true,
                        pascalCase: true,
                    },
                    ignore: [
                        // Next.js reserved and specific logic files
                        "index.tsx",
                        "route.ts",
                        "route.tsx",
                        "layout.tsx",
                        "page.tsx",
                        "loading.tsx",
                        "error.tsx",
                        "not-found.tsx",
                        "template.tsx",
                        "instrumentation.ts",
                        "middleware.ts",
                        "types.ts",
                        "utils.ts",
                        "global.css",
                        // Allow PascalCase for TSX components is handled by the "pascalCase: true" above
                    ],
                },
            ],
        },
    },
    {
        files: ["**/api-server/gantt/schema/**"],
        rules: {
            "no-restricted-imports": "off",
            "import/no-cycle": "off",
        },
    },
    {
        files: [
            "**/app/**/{page,layout,-layout,error,not-found,loading,template,default}.tsx",
            "**/app/**/route.ts",
            "**/*.config.{ts,js,mjs,mts}",
            "**/manifest.{ts,js,mjs,mts}",
        ],
        rules: { "import/no-default-export": "off" },
    },
    {
        files: ["**/*.js", "**/*.mjs", "**/*.mts"],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        ignores: [
            ".next/*",
            "out/*",
            "dist/*",
            "ui/.next/*",
            "ui/out/*",
            "ui/dist/*",
            "node_modules/*",
            "ui/next-env.d.ts",
            // These files are not directly part of the UI, and cause the linter to freak out
            "drizzle/drizzle.config.ts",
            "session-server/session-common.ts",
            "session-server/session-server.ts",
            "scripts/**",
            "tests/**",
            ".agents/**",
        ],
    },
]);
