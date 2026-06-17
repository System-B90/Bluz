import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
    plugins: [
        tsconfigPaths({
            projects: [path.resolve(__dirname, "ui/tsconfig.json")],
        }),
    ],
    test: {
        environment: "node",
        include: ["tests/backend/**/*.test.ts"],
        alias: {
            "@": path.resolve(__dirname, "ui/src"),
        },
    },
});
