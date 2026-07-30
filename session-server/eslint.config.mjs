import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        // `dist/` is tsc's CommonJS output — linting it yields dozens of
        // no-undef/no-require-imports errors for `exports` and `require`. CI
        // only passed because it lints before building; running the two in the
        // other order locally failed.
        ignores: ["node_modules/**", "dist/**"],
    },
);
