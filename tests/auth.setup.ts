import * as fs from "fs";
import * as path from "path";

import { test as setup, expect, Page } from "@playwright/test";

import { SELECTORS } from "./fixtures";

const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");

async function waitForAuthApi(page: Page, baseURL: string): Promise<void> {
    for (let attempt = 1; attempt <= 10; attempt++) {
        const response = await page.request.get(`${baseURL}/api/auth/csrf`);
        if (response.ok()) {
            return;
        }

        await page.waitForTimeout(3_000);
    }

    throw new Error("NextAuth API is not ready");
}

async function startHiveSso(page: Page, baseURL: string): Promise<void> {
    await waitForAuthApi(page, baseURL);

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const csrfResponse = await page.request.get(`${baseURL}/api/auth/csrf`);
            if (!csrfResponse.ok()) {
                throw new Error(`CSRF request failed: ${csrfResponse.status()}`);
            }

            const { csrfToken } = await csrfResponse.json();
            const signInResponse = await page.request.post(
                `${baseURL}/api/auth/signin/hive`,
                {
                    form: {
                        csrfToken,
                        callbackUrl: `${baseURL}/`,
                        json: "true",
                    },
                },
            );
            if (!signInResponse.ok()) {
                throw new Error(
                    `Sign-in request failed: ${signInResponse.status()}`,
                );
            }

            const signInData = await signInResponse.json();

            await page.goto(signInData.url, {
                waitUntil: "commit",
                timeout: 60_000,
            });
            await page.waitForURL(/hive\.org/, { timeout: 60_000 });
            return;
        } catch (error) {
            if (attempt === maxAttempts) {
                throw error;
            }

            await page.waitForTimeout(3_000 * attempt);
        }
    }
}

async function tryGoto(
    page: Page,
    url: string,
    timeout = 30_000,
): Promise<boolean> {
    try {
        const response = await page.goto(url, {
            waitUntil: "commit",
            timeout,
        });

        return !!response && response.status() < 500;
    } catch {
        return false;
    }
}

async function gotoReliable(page: Page, url: string): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (await tryGoto(page, url, 45_000)) {
            return;
        }

        if (attempt < maxAttempts) {
            await page.waitForTimeout(2_000 * attempt);
        }
    }

    throw new Error(`Failed to navigate to ${url}`);
}

/**
 * Authentication setup project.
 *
 * Authenticates against the running Bluz instance via the Hive SSO OAuth flow.
 * Uses the admin account (admin:Password1) on the Hive instance at https://hive.org.
 *
 * On consecutive runs, optimistically reuses .auth/user.json if the session is
 * still valid; otherwise performs the full SSO flow and refreshes the saved state.
 */
setup("authenticate via Hive SSO", async ({ browser }) => {
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    // Try to reuse a previously saved session before starting SSO
    if (fs.existsSync(AUTH_FILE)) {
        const reuseContext = await browser.newContext({
            storageState: AUTH_FILE,
        });
        const reusePage = await reuseContext.newPage();

        // Fast optimistic check — post-auth routes redirect to /login when expired.
        if (
            (await tryGoto(reusePage, "/")) &&
            !reusePage.url().includes("/login")
        ) {
            await reuseContext.storageState({ path: AUTH_FILE });
            await reuseContext.close();
            return;
        }

        await reuseContext.close();
    }

    // Session missing or expired — perform the full Hive SSO flow in a clean context
    const context = await browser.newContext();
    const page = await context.newPage();

    const baseURL = setup.info().project.use.baseURL as string;

    // Seed NextAuth CSRF cookies, then start OAuth via the API rather than the
    // login button so setup does not depend on client-side React hydration.
    await gotoReliable(page, "/login");

    if (!page.url().includes("/login")) {
        await context.storageState({ path: AUTH_FILE });
        await context.close();
        return;
    }

    await startHiveSso(page, baseURL);

    const usernameField = page
        .locator(
            "input[name='username'], input[name='login'], input[type='text']",
        )
        .first();
    const passwordField = page.locator(
        "input[name='password'], input[type='password']",
    ).first();

    await usernameField.waitFor({ state: "visible", timeout: 30_000 });
    await usernameField.fill("admin");
    await passwordField.fill("Password1");

    const submitButton = page
        .locator("button[type='submit'], input[type='submit']")
        .first();
    await submitButton.click();

    try {
        const authorizeButton = page.locator(
            "button:has-text('Authorize'), button:has-text('Allow'), button:has-text('אשר'), input[type='submit'][value='Authorize']",
        );
        await authorizeButton.waitFor({ state: "visible", timeout: 5_000 });
        await authorizeButton.click();
    } catch {
        // No authorization screen — continue
    }

    await page.waitForURL(
        (url) =>
            !url.hostname.includes("hive") && !url.pathname.includes("/login"),
        { timeout: 60_000 },
    );

    await expect(page.locator(SELECTORS.calendarRoot)).toBeVisible({
        timeout: 60_000,
    });

    await context.storageState({ path: AUTH_FILE });
    await context.close();
});
