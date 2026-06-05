import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, "..", ".auth", "user.json");

/**
 * Authentication setup project.
 *
 * Authenticates against the running Bluz instance via the Hive SSO OAuth flow.
 * Uses the admin account (admin:Password1) on the Hive instance at https://hive.org.
 *
 * The authenticated session is saved to .auth/user.json for reuse by all tests.
 */
setup("authenticate via Hive SSO", async ({ page }) => {
    // Ensure .auth directory exists
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    // Navigate to the Bluz login page
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Check if we're already authenticated (not on login page)
    if (!page.url().includes("/login")) {
        // Already authenticated — save and exit
        await page.context().storageState({ path: AUTH_FILE });
        return;
    }

    // Click the "התחברות עם הייב" button to initiate the OAuth flow
    const loginButton = page.getByText("התחברות עם הייב");
    await expect(loginButton).toBeVisible({ timeout: 10_000 });
    await loginButton.click();

    // Wait for the Hive SSO login page to load
    // The OAuth flow redirects to hive.org for authentication
    await page.waitForURL(/hive\.org/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // Fill in the Hive SSO credentials (admin:Password1)
    // The Hive login form uses standard username/password fields
    const usernameField = page.locator(
        "input[name='username'], input[name='login'], input[type='text']",
    ).first();
    const passwordField = page.locator(
        "input[name='password'], input[type='password']",
    ).first();

    await usernameField.waitFor({ state: "visible", timeout: 10_000 });
    await usernameField.fill("admin");
    await passwordField.fill("Password1");

    // Submit the login form
    const submitButton = page.locator(
        "button[type='submit'], input[type='submit']",
    ).first();
    await submitButton.click();

    // Handle potential OAuth consent/authorize screen
    // Some OAuth providers show an "Authorize" button after login
    try {
        const authorizeButton = page.locator(
            "button:has-text('Authorize'), button:has-text('Allow'), button:has-text('אשר'), input[type='submit'][value='Authorize']",
        );
        await authorizeButton.waitFor({ state: "visible", timeout: 5_000 });
        await authorizeButton.click();
    } catch {
        // No authorization screen — continue
    }

    // Wait for the redirect back to Bluz (authenticated)
    await page.waitForURL(
        (url) => !url.hostname.includes("hive") && !url.pathname.includes("/login"),
        { timeout: 30_000 },
    );

    // Verify we've landed on the authenticated app
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForLoadState("networkidle");

    // Save the authenticated state
    await page.context().storageState({ path: AUTH_FILE });
});
