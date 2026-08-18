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
        //
        // Vitest 4 removed `poolOptions` and promoted these to top level. The
        // old nesting was silently ignored, so the cap had stopped applying —
        // which is exactly the starvation it was added to prevent.
        maxForks: 4,
        // The backend suite is import-bound, not compute-bound: a single
        // `api-server` test file pulls in the Drizzle/Postgres stack and the
        // gantt planner graph, which costs seconds to transform and evaluate
        // while the test bodies themselves run in milliseconds. Vitest charges
        // that lazy import cost to whichever test first touches the module, so
        // the default 5s budget is spent on module loading rather than on the
        // assertion — and on the shared self-hosted runners above it tips over
        // into a spurious "Test timed out in 5000ms". Raised so a timeout means
        // a genuinely hung test.
        testTimeout: 30_000,
        hookTimeout: 30_000,
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

