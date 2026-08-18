import path from "path";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    // Vite 8 resolves tsconfig `paths` natively, so the `vite-tsconfig-paths`
    // plugin is gone — it was the only thing pulling in the deprecated,
    // unmaintained `tsconfck`. Vitest had been emitting this exact advice on
    // every run. See #380.
    resolve: { tsconfigPaths: true },
    test: {
        environment: "node",
        // `.tsx` too: component tests for the gantt dialogs opt into jsdom
        // per file (`// @vitest-environment jsdom`).
        include: [ "tests/backend/**/*.test.ts", "tests/backend/**/*.test.tsx" ],
        exclude: [ ...configDefaults.exclude, "**/.claude/**", "**/worktrees/**" ],
        alias: {
            "@": path.resolve(__dirname, "../ui/src"),
        },
        // Self-hosted CI runners are shared/resource-constrained; spawning
        // many forks at once starves worker startup and vitest kills them
        // with "Timeout waiting for worker to respond" (flaky CI failures,
        // not real test bugs). Capping concurrent forks avoids that.
        poolOptions: {
            forks: { maxForks: 4 },
        },
        // Mock fallbacks so `npm run test:unit` runs without a configured
        // environment (NextAuth/SSO modules throw at import if these are unset).
        env: {
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "test-secret",
            NEXT_PUBLIC_HIVE_URL:
                process.env.NEXT_PUBLIC_HIVE_URL ?? "https://hive.test",
            HIVE_CLIENT_ID: process.env.HIVE_CLIENT_ID ?? "test-client-id",
            HIVE_CLIENT_SECRET:
                process.env.HIVE_CLIENT_SECRET ?? "test-client-secret",
        },
    },
});

