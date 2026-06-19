import { test, expect } from "./fixtures";

/**
 * Login page tests — run WITHOUT auth state to verify the unauthenticated flow.
 * These tests use a separate project context that skips the auth setup.
 */

test.describe("Login Page", () => {
    test("renders the login page with logo, heading, and subtitle", async ({
        page,
    }) => {
        await page.goto("/login", { waitUntil: "commit" });

        // Verify the main heading
        await expect(page.getByText("ברוכים הבאים לבלוז")).toBeVisible();

        // Verify the subtitle
        await expect(page.getByText("מתי אתם מבזרים?")).toBeVisible();
    });

    test("displays the Hive SSO login button", async ({ page }) => {
        await page.goto("/login", { waitUntil: "commit" });

        // The LoginWithHive component renders a sign-in button
        const loginButton = page.locator("button, a").filter({
            hasText: /hive|התחבר|כניסה/i,
        });
        await expect(loginButton.first()).toBeVisible();
    });

    test("shows error alert for AccessDenied", async ({ page }) => {
        await page.goto("/login?error=AccessDenied", { waitUntil: "commit" });

        // Verify error alert renders
        await expect(page.getByText("ההתחברות נכשלה")).toBeVisible();
        await expect(
            page.getByText("למשתמש שלך אין הרשאה מתאימה לגישה למערכת."),
        ).toBeVisible();
    });

    test("shows error alert for SessionRequired", async ({ page }) => {
        await page.goto("/login?error=SessionRequired", {
            waitUntil: "commit",
        });

        await expect(page.getByText("ההתחברות נכשלה")).toBeVisible();
        await expect(
            page.getByText("נדרשת התחברות מחדש כדי להמשיך."),
        ).toBeVisible();
    });

    test("shows error alert for OAuthCallback", async ({ page }) => {
        await page.goto("/login?error=OAuthCallback", { waitUntil: "commit" });

        await expect(page.getByText("ההתחברות נכשלה")).toBeVisible();
        await expect(
            page.getByText("לא ניתן היה להשלים את תהליך ההזדהות מול הייב."),
        ).toBeVisible();
    });

    test("shows generic error for unknown error codes", async ({ page }) => {
        await page.goto("/login?error=SomethingWeird", { waitUntil: "commit" });

        await expect(page.getByText("ההתחברות נכשלה")).toBeVisible();
        await expect(
            page.getByText("אירעה שגיאה במהלך תהליך ההתחברות."),
        ).toBeVisible();
    });

    test("redirects unauthenticated root access to login", async ({ page }) => {
        await page.goto("/", { waitUntil: "commit" });

        // Should redirect to /login
        await expect(page).toHaveURL(/\/login/);
    });
});
