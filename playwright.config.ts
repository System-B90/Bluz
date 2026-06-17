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
    testDir: "./tests",
    testIgnore: "tests/backend/**",
    timeout: 15_000,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: 1,
    reporter: process.env.CI ? [["html"], ["github"]] : [["html"], ["list"]],

    use: {
        baseURL: process.env.BASE_URL ?? "https://bluz.dev",
        ignoreHTTPSErrors: true,
        screenshot: "only-on-failure",
        video: "on-first-retry",
        trace: "on-first-retry",
        locale: "he-IL",
        timezoneId: "Asia/Jerusalem",
    },

    projects: [
        {
            name: "login",
            testMatch: /login\.spec\.ts/,
            use: {
                ...devices["Desktop Chrome"],
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
            testIgnore: [/login\.spec\.ts/, /auth\.setup\.ts/],
            use: {
                ...devices["Desktop Chrome"],
                storageState: ".auth/user.json",
            },
            dependencies: ["setup"],
        },
    ],
});
