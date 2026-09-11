import * as fs from "fs";
import * as path from "path";

import { Browser, expect, Page, test as setup } from "@playwright/test";
import { hiveLogin } from "@system-b90/test-kit/auth";

import { AUTH_FILES, SELECTORS } from "./fixtures";

const AUTH_FILE = AUTH_FILES.primary;

/**
 * Credentials for each session.
 *
 * `admin` is Hive's superuser, created by the stack bring-up. `michaelks` is
 * seeded by scripts/demo/populate_demo_hive.py with ADMIN clearance and the
 * password "test", so it carries the same permissions as the primary user and
 * any difference in behaviour between the two sessions is about *identity*,
 * not about what each is allowed to do.
 */
export const TEST_USERS = {
    primary: { username: "admin", password: "Password1" },
    secondary: { username: "michaelks", password: "test" },
    /**
     * The Hanich ("חניך") fixture seeded by
     * scripts/demo/populate_demo_hive.py's `create_e2e_student`. The only
     * account in the suite without staff clearance, and the only one that can
     * prove the student boundary holds against a real session rather than a
     * mocked one (#656).
     */
    student: { username: "test-hanich-e2e", password: "test" },
} as const;

async function tryGoto(
    page: Page,
    url: string,
    timeout = 30_000,
): Promise<boolean>
{
    try
    {
        const response = await page.goto(url, {
            waitUntil: "commit",
            timeout,
        });

        return !!response && response.status() < 500;
    } catch
    {
        return false;
    }
}

/**
 * Marks the gantt intro tour (ui/src/components/app-onboarding/gantt/use-gantt-tour.tsx,
 * GANTT_TOUR_ID "gantt.intro", version 1) as already seen.
 *
 * The tour has `autoStart: true` and a fresh browser context has no
 * localStorage, so every gantt test would otherwise launch it — its spotlight
 * backdrop (a fixed, full-viewport MuiBox) then intercepts every click on the
 * page underneath until a human dismisses it, which no test does. Saved into
 * this setup's storageState so it rides along on every session it produces.
 */
async function suppressOnboardingTours(page: Page): Promise<void>
{
    await page.evaluate(() => {
        try
        {
            localStorage.setItem(
                "bluz:onboarding:completions:v1",
                JSON.stringify({
                    "gantt.intro": {
                        version: 1,
                        at: new Date().toISOString(),
                        reason: "completed",
                    },
                }),
            );
        }
        catch
        {
            // Storage unavailable — the tour will just show up in the test; not fatal.
        }
    });
}

async function gotoReliable(page: Page, url: string): Promise<void>
{
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++)
    {
        if (await tryGoto(page, url, 45_000))
        {
            return;
        }

        if (attempt < maxAttempts)
        {
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
async function authenticateAs(
    browser: Browser,
    baseURL: string,
    { username, password }: { username: string; password: string },
    AUTH_FILE: string,
    // A student never reaches the calendar — the post-auth layout bounces them
    // to /student-view — so the "signed in" assertion differs by clearance.
    landingSelector: string = SELECTORS.calendarRoot,
): Promise<void>
{
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir))
    {
        fs.mkdirSync(authDir, { recursive: true });
    }

    // Try to reuse a previously saved session before starting SSO
    if (fs.existsSync(AUTH_FILE))
    {
        const reuseContext = await browser.newContext({
            storageState: AUTH_FILE,
        });
        const reusePage = await reuseContext.newPage();

        // Fast optimistic check — post-auth routes redirect to /login when
        // expired. A student session redirects to /student-view instead, which
        // is a *valid* session, so only /login means "expired".
        if (
            (await tryGoto(reusePage, "/")) &&
            !reusePage.url().includes("/login")
        )
        {
            await suppressOnboardingTours(reusePage);
            await reuseContext.storageState({ path: AUTH_FILE });
            await reuseContext.close();
            return;
        }

        await reuseContext.close();
    }

    // Session missing or expired — perform the full Hive SSO flow in a clean context
    const context = await browser.newContext();
    const page = await context.newPage();

    // Seed NextAuth CSRF cookies, then start OAuth via the API rather than the
    // login button so setup does not depend on client-side React hydration.
    await gotoReliable(page, "/login");

    if (!page.url().includes("/login"))
    {
        await suppressOnboardingTours(page);
        await context.storageState({ path: AUTH_FILE });
        await context.close();
        return;
    }

    await hiveLogin(page, { baseURL, username, password });

    await expect(page.locator(landingSelector)).toBeVisible({
        timeout: 60_000,
    });

    await suppressOnboardingTours(page);
    await context.storageState({ path: AUTH_FILE });
    await context.close();
}

setup("authenticate via Hive SSO", async ({ browser }) =>
{
    await authenticateAs(
        browser,
        setup.info().project.use.baseURL as string,
        TEST_USERS.primary,
        AUTH_FILES.primary,
    );
});

/**
 * A second, independent session. Needed for anything that has to observe one
 * user's change arriving on another user's screen — see #582; a single browser
 * cannot tell a working broadcast from a dead one.
 */
setup("authenticate a second user via Hive SSO", async ({ browser }) =>
{
    await authenticateAs(
        browser,
        setup.info().project.use.baseURL as string,
        TEST_USERS.secondary,
        AUTH_FILES.secondary,
    );
});

/**
 * The student session (#656). Everything the student-view specs assert — that
 * staff pages bounce, that staff APIs 403, that the socket carries no calendar
 * data — is only meaningful against a real Hanich session issued by Hive, so
 * this one goes through the same SSO flow as the staff accounts.
 */
setup("authenticate a student via Hive SSO", async ({ browser }) =>
{
    await authenticateAs(
        browser,
        setup.info().project.use.baseURL as string,
        TEST_USERS.student,
        AUTH_FILES.student,
        SELECTORS.studentBoard,
    );
});
