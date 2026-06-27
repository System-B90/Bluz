import path from "path";

import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [
        tsconfigPaths({
            projects: [ path.resolve(__dirname, "../ui/tsconfig.json") ],
        }),
    ],
    test: {
        environment: "node",
        include: [ "tests/backend/**/*.test.ts" ],
        exclude: [ ...configDefaults.exclude, "**/.claude/**", "**/worktrees/**" ],
        alias: {
            "@": path.resolve(__dirname, "../ui/src"),
        },
    },
});

