import * as path from "path";

import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Bluz integration tests.
 *
 * Usage:
 * 1. Start test containers: npm run docker:test
 * 2. Run tests: npm run test:e2e
 * 3. Run with UI: npm run test:e2e:ui
 * 4. Tear down: npm run docker:test:down
 *
 * The test suite:
 * - Authenticates via Hive SSO (admin:Password1) in the setup project
 * - Saves auth state to .auth/user.json for test reuse
 * - Requires a running Bluz dev instance at BASE_URL (default: https://bluz.dev)
 * - Runs in Hebrew locale (he-IL) with Jerusalem timezone
 *
 * Environment Variables:
 * - BASE_URL: Override default Bluz URL (default: "https://bluz.dev")
 */
export default defineConfig({
    testDir: ".",
    testMatch: "**/*.spec.ts",
    testIgnore: [ /worktrees/, /\.claude/ ],
    timeout: 15_000,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: 1,
    reporter: process.env.CI ? [ [ "html" ], [ "github" ] ] : [ [ "html" ], [ "list" ] ],

    use: {
        baseURL: process.env.BASE_URL ?? "https://bluz.dev",
        ignoreHTTPSErrors: true,
        // Chromium keeps shared-memory tabs in /dev/shm, which is only 64 MB
        // by default inside containers — exhausting it crashes the tab/browser
        // ("Target page/context/browser has been closed"), cascading to every
        // later test in the worker. The self-hosted runner also raises
        // shm_size, but this flag makes any container host safe.
        launchOptions: { args: [ "--disable-dev-shm-usage" ] },
        screenshot: "only-on-failure",
        video: "on-first-retry",
        // retain-on-failure, not on-first-retry: with retries enabled the
        // first (failing) attempt is the one that carries the evidence, and
        // "on-first-retry" only traces the *re-run* — which usually passes,
        // so a flake investigation ends up staring at a green trace.
        trace: "retain-on-failure",
        locale: "he-IL",
        timezoneId: "Asia/Jerusalem",
    },

    projects: [
        {
            name: "login",
            testMatch: /login\.spec\.ts/,
            use: {
                ...devices[ "Desktop Chrome" ],
                storageState: { cookies: [], origins: [] },
            },
        },
        {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
            timeout: 240_000,
        },
        {
            name: "chromium",
            testIgnore: [ /login\.spec\.ts/, /auth\.setup\.ts/, /backend/, /worktrees/, /\.claude/ ],
            use: {
                ...devices[ "Desktop Chrome" ],
                // Absolute path: the custom context fixture passes this raw to
                // browser.newContext(), which resolves relative paths against
                // the process CWD rather than this config's directory.
                storageState: path.join(__dirname, ".auth", "user.json"),
            },
            dependencies: [ "setup" ],
        },
    ],
});
