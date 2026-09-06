import * as path from "path";

import { devices } from "@playwright/test";
import { definePlaywrightConfig } from "@system-b90/test-kit/playwright";

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
export default definePlaywrightConfig({
    timeout: 15_000,
    fullyParallel: false,
    workers: 1,

    use: {
        baseURL: process.env.BASE_URL ?? "https://bluz.dev",
        screenshot: "only-on-failure",
        video: "on-first-retry",
        // retain-on-failure, not on-first-retry: with retries enabled the
        // first (failing) attempt is the one that carries the evidence, and
        // "on-first-retry" only traces the *re-run* — which usually passes,
        // so a flake investigation ends up staring at a green trace.
        trace: "retain-on-failure",
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
