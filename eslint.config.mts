import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: [ "**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}" ],
    plugins: { js },
    extends: [ "js/recommended" ],
    languageOptions: { globals: globals.browser },
  },

  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn", // or "off" / "error" depending on your preference
        {
          "argsIgnorePattern": "^_",  // ignore unused function arguments starting with _
          "varsIgnorePattern": "^_",  // ignore unused variables starting with _
          "caughtErrorsIgnorePattern": "^_" // optional, ignore unused catch errors starting with _
        }
      ]
    }
  }
]);
