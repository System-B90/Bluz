import type { APIRequestContext } from "@playwright/test";

import {
    test,
    expect,
    SELECTORS,
    SECONDARY_USER_STATE,
    openSettingsDialog,
    navigateToSettingsTab,
    gotoAppHome,
} from "./fixtures";

/**
 * Google Calendar integration card in personal settings.
 *
 * Google itself is never reached. Server-side, the test ui container talks to
 * the `google-stub` service for the token exchange and the Calendar API
 * (deploy/docker-compose.test.yml, #579). Browser-side, the Google Identity
 * Services script is replaced per test with one whose popup immediately
 * returns an authorization code.
 */

/** Stands in for https://accounts.google.com/gsi/client: the popup "succeeds". */
const FAKE_GSI_SCRIPT = `
window.google = window.google || {};
window.google.accounts = {
    oauth2: {
        initCodeClient: (config) => ({
            requestCode: () => setTimeout(() => config.callback({ code: "e2e-stub-code" }), 0),
        }),
    },
};
`;

test.describe("Google Calendar integration", () => {
    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "אישי");
    });

    test("renders the card with an off, unchecked toggle while disconnected", async ({
        page,
    }) => {
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        const heading = dialog.getByText("Google Calendar");
        await heading.scrollIntoViewIfNeeded();
        await expect(heading).toBeVisible();
        await expect(
            dialog.getByText("סנכרון דו-כיווני", { exact: false }),
        ).toBeVisible();

        // The switch nearest the Google Calendar heading — unchecked while
        // no account is connected. (Whether it's enabled depends on whether
        // this deployment has a Google client configured server-side, which
        // this test doesn't assume either way.)
        const googleSwitch = heading
            .locator("xpath=ancestor::div[3]")
            .locator(`${SELECTORS.switch} input`);
        await expect(googleSwitch).toBeVisible();
        await expect(googleSwitch).not.toBeChecked();
    });

    test("does not show sync-all-events or disconnect controls when disconnected", async ({
        page,
    }) => {
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await expect(dialog.getByText("Google Calendar")).toBeVisible();
        await expect(
            dialog.getByText('סנכרון כל אירועי הלו"ז'),
        ).toBeHidden();
        await expect(
            dialog.getByRole("button", { name: "נתק חשבון" }),
        ).toBeHidden();
        await expect(
            dialog.getByRole("button", { name: "סנכרן עכשיו" }),
        ).toBeHidden();
    });

    test("connects through the stub, shows the connected controls, and disconnects (#579)", async ({
        page,
        request,
    }) => {
        await page.route("https://accounts.google.com/gsi/client", (route) =>
            route.fulfill({ contentType: "text/javascript", body: FAKE_GSI_SCRIPT }),
        );

        const dialog = page.locator(SELECTORS.settingsDialog).first();
        const heading = dialog.getByText("Google Calendar");
        await heading.scrollIntoViewIfNeeded();
        const googleSwitch = heading
            .locator("xpath=ancestor::div[3]")
            .locator(`${SELECTORS.switch} input`)
            .first();
        // Enabled only because the stack now has a (stub) client configured.
        await expect(googleSwitch).toBeEnabled();

        try {
            await googleSwitch.check();
            await expect(page.getByText("חשבון Google חובר בהצלחה.")).toBeVisible({
                timeout: 15_000,
            });

            const status = await request.get("/api/integrations/google-calendar/status");
            expect(status.ok()).toBeTruthy();
            expect((await status.json()).data).toMatchObject({
                configured: true,
                connected: true,
            });

            const syncNow = dialog.getByRole("button", { name: "סנכרן עכשיו" });
            const disconnect = dialog.getByRole("button", { name: "נתק חשבון" });
            await expect(syncNow).toBeVisible();
            await expect(disconnect).toBeVisible();
            await expect(dialog.getByText('סנכרון כל אירועי הלו"ז')).toBeVisible();
            // The connected extras: which calendar, who else shares it, purge.
            await expect(
                dialog.getByRole("combobox", { name: "יומן יעד ב-Google" }),
            ).toBeVisible();
            await expect(
                dialog.getByRole("button", { name: "הסר אירועים יתומים" }),
            ).toBeVisible();

            // A sync round-trips the stub's Calendar API rather than failing.
            await syncNow.click();
            await expect(page.getByText(/^סונכרנו \d+ אירועים/)).toBeVisible({
                timeout: 30_000,
            });

            await disconnect.click();
            await expect(page.getByText("החיבור ל-Google Calendar נותק.")).toBeVisible();
            await expect(syncNow).toBeHidden();
            await expect(disconnect).toBeHidden();
            await expect(googleSwitch).not.toBeChecked();

            const after = await request.get("/api/integrations/google-calendar/status");
            expect((await after.json()).data.connected).toBe(false);
        } finally {
            // Never leave the shared test user linked for the specs above.
            await request.post("/api/integrations/google-calendar/disconnect");
        }
    });
});

// ─── Shared calendar + purge ───────────────────────────────────────────────────

/**
 * The stub's host-exposed control surface (deploy/docker-compose.test.yml
 * publishes it on TEST_GOOGLE_STUB_PORT; run_tests.py hands the URL over).
 */
const GOOGLE_STUB_URL = process.env.GOOGLE_STUB_URL ?? "http://127.0.0.3:18080";
const SHARED_CALENDAR_ID = "shared-team";
const SHARED_CALENDAR_NAME = "יומן צוות משותף";

type StubEvent = {
    id: string;
    status?: string;
    extendedProperties?: { private?: Record<string, string> };
};

async function stubEvents(stub: APIRequestContext): Promise<Array<StubEvent>> {
    const response = await stub.get(`/__stub/calendars/${SHARED_CALENDAR_ID}/events`);
    expect(response.ok(), "stub calendar listing failed").toBeTruthy();
    return (await response.json()).items;
}

/** Polls the stub until `predicate` holds over the shared calendar's events. */
async function waitForStub(
    stub: APIRequestContext,
    predicate: (events: Array<StubEvent>) => boolean,
    label: string,
): Promise<Array<StubEvent>> {
    let events: Array<StubEvent> = [];
    await expect
        .poll(
            async () => {
                events = await stubEvents(stub);
                return predicate(events);
            },
            { message: label, timeout: 20_000 },
        )
        .toBe(true);
    return events;
}

async function connectViaApi(request: APIRequestContext): Promise<void> {
    const response = await request.post("/api/integrations/google-calendar/connect", {
        data: { code: "e2e-stub-code" },
    });
    expect(response.ok(), "connect through the stub failed").toBeTruthy();
}

async function googleStatus(request: APIRequestContext) {
    const response = await request.get("/api/integrations/google-calendar/status");
    expect(response.ok()).toBeTruthy();
    return (await response.json()).data as {
        connected: boolean;
        calendar?: { id: string; iterationId?: string; linkedUsers: number };
    };
}

async function setGoogleSettings(
    request: APIRequestContext,
    enabled: boolean,
    syncAll: boolean,
): Promise<Record<string, unknown>> {
    const current = (await (await request.get("/api/personal-settings")).json()).data;
    const response = await request.post("/api/personal-settings", {
        data: {
            ...current,
            googleCalendarEnabled: enabled,
            googleCalendarSyncAllEvents: syncAll,
        },
    });
    expect(response.ok(), "saving personal settings failed").toBeTruthy();
    return current;
}

test.describe("Google Calendar — shared calendar and purge", () => {
    test("two users mirror one shared calendar; each event lands once; purge removes orphans then everything (#579)", async ({
        page,
        request,
        playwright,
    }) => {
        test.setTimeout(120_000);
        const stub = await playwright.request.newContext({ baseURL: GOOGLE_STUB_URL });
        const secondary = await playwright.request.newContext({
            baseURL: process.env.BASE_URL ?? "https://bluz.dev",
            ignoreHTTPSErrors: true,
            storageState: SECONDARY_USER_STATE,
        });
        const eventId = crypto.randomUUID();
        const eventName = `e2e google shared ${Date.now()}`;
        let previousSettings: Record<string, unknown> | null = null;

        try {
            // ── Stub: a calendar a colleague owns and shared with write access
            await stub.post("/__stub/reset");
            const seeded = await stub.post("/__stub/shared-calendar", {
                data: { id: SHARED_CALENDAR_ID, summary: SHARED_CALENDAR_NAME, accessRole: "writer" },
            });
            expect(seeded.ok()).toBeTruthy();

            // ── Primary user: connect (API), pick the shared calendar in the UI
            await connectViaApi(request);
            previousSettings = await setGoogleSettings(request, true, true);

            await page.reload();
            await openSettingsDialog(page);
            await navigateToSettingsTab(page, "אישי");
            const dialog = page.locator(SELECTORS.settingsDialog).first();
            const picker = dialog.getByRole("combobox", { name: "יומן יעד ב-Google" });
            await picker.scrollIntoViewIfNeeded();
            await expect(picker).toBeVisible();
            await expect(dialog.getByText("רק אתם מסנכרנים ליומן זה")).toBeVisible();

            await picker.click();
            const option = page.getByRole("option", { name: new RegExp(SHARED_CALENDAR_NAME) });
            await expect(option).toBeVisible();
            // Flagged as shared — it is somebody else's calendar.
            await expect(option.getByText("משותף")).toBeVisible();
            await option.click();
            await expect(
                page.getByText(`היומן "${SHARED_CALENDAR_NAME}" חובר.`, { exact: false }),
            ).toBeVisible({ timeout: 15_000 });

            const afterPick = await googleStatus(request);
            expect(afterPick.calendar?.id).toBe(SHARED_CALENDAR_ID);

            // ── Secondary user joins the same calendar (API only)
            await connectViaApi(secondary);
            const joined = await secondary.post("/api/integrations/google-calendar/calendars", {
                data: { calendarId: SHARED_CALENDAR_ID },
            });
            expect(joined.ok(), "secondary user could not select the shared calendar").toBeTruthy();
            expect((await googleStatus(secondary)).calendar?.id).toBe(SHARED_CALENDAR_ID);
            expect((await googleStatus(request)).calendar?.linkedUsers).toBe(2);

            // ── One Bluz event → exactly one copy in the shared calendar
            const start = new Date(Date.now() + 60 * 60 * 1000);
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            const created = await request.put("/api/event", {
                data: {
                    id: eventId,
                    name: eventName,
                    type: 'ע"ע',
                    subject: null,
                    hiveModule: null,
                    hiveLesson: null,
                    hiveQueues: {},
                    startTime: start.toISOString(),
                    endTime: end.toISOString(),
                    courses: [],
                    rooms: [],
                    instructors: [],
                    lecturers: [],
                    tags: [],
                    notes: "",
                    locked: false,
                    hidden: false,
                    required: false,
                    personalTalk: false,
                    splitAcrossBreaks: false,
                },
            });
            expect(created.ok(), "creating the Bluz event failed").toBeTruthy();

            const mirrored = await waitForStub(
                stub,
                (events) => events.some((e) => e.extendedProperties?.private?.bluzEventId === eventId),
                "the event never reached the shared stub calendar",
            );
            const copies = mirrored.filter(
                (e) => e.extendedProperties?.private?.bluzEventId === eventId,
            );
            expect(copies, "a shared calendar must hold each event once").toHaveLength(1);
            expect(copies[0].status).toBe("confirmed");
            expect(copies[0].extendedProperties?.private?.bluzManaged).toBe("true");
            const iterationId = afterPick.calendar?.iterationId;
            if (iterationId) {
                expect(copies[0].extendedProperties?.private?.bluzIterationId).toBe(iterationId);
            }

            // ── Seed what a purge must and must not touch
            const orphan = await stub.post(`/calendar/v3/calendars/${SHARED_CALENDAR_ID}/events`, {
                data: {
                    id: "orphan00001",
                    summary: "orphan",
                    extendedProperties: {
                        private: {
                            bluzManaged: "true",
                            bluzEventId: "00000000-0000-4000-8000-000000000000",
                            ...(iterationId ? { bluzIterationId: iterationId } : {}),
                        },
                    },
                },
            });
            expect(orphan.ok()).toBeTruthy();
            const handMade = await stub.post(`/calendar/v3/calendars/${SHARED_CALENDAR_ID}/events`, {
                data: { id: "handmade001", summary: "רופא שיניים" },
            });
            expect(handMade.ok()).toBeTruthy();

            // ── Purge orphans from the UI
            await dialog.getByRole("button", { name: "הסר אירועים יתומים" }).click();
            const confirmDialog = page.getByRole("dialog", { name: "הסרת אירועים יתומים" });
            await expect(confirmDialog).toBeVisible();
            await confirmDialog.getByRole("button", { name: "הסר" }).click();
            await expect(page.getByText(/^נסרקו 2 אירועי Bluz ביומן, הוסרו 1\./)).toBeVisible({
                timeout: 30_000,
            });

            let events = await stubEvents(stub);
            const byId = (id: string) => events.find((e) => e.id === id);
            expect(byId("orphan00001")?.status).toBe("cancelled");
            expect(byId("handmade001")?.status).toBe("confirmed");
            expect(copies[0].id && byId(copies[0].id)?.status).toBe("confirmed");

            // ── Purge everything Bluz made, from the UI
            await dialog.getByRole("button", { name: "הסר את כל אירועי Bluz מהיומן" }).click();
            const confirmAll = page.getByRole("dialog", { name: "הסרת כל אירועי Bluz מהיומן" });
            await expect(confirmAll).toBeVisible();
            await confirmAll.getByRole("button", { name: "הסר" }).click();
            await expect(page.getByText(/^נסרקו 1 אירועי Bluz ביומן, הוסרו 1\./)).toBeVisible({
                timeout: 30_000,
            });

            events = await stubEvents(stub);
            expect(byId(copies[0].id)?.status).toBe("cancelled");
            expect(byId("handmade001")?.status).toBe("confirmed");

            // ── A manual sync re-creates the live copy through the 409 path
            // (the stub still holds the id as a tombstone, as Google does).
            const synced = await request.post("/api/integrations/google-calendar/sync");
            expect(synced.ok()).toBeTruthy();
            expect((await synced.json()).data.pushed).toBeGreaterThanOrEqual(1);
            await waitForStub(
                stub,
                (all) => all.find((e) => e.id === copies[0].id)?.status === "confirmed",
                "the sync did not revive the purged copy",
            );

            // ── Deleting in Bluz removes it from the shared calendar once more
            const deleted = await request.delete("/api/event", { data: JSON.stringify(eventId) });
            expect(deleted.ok()).toBeTruthy();
            await waitForStub(
                stub,
                (all) => all.find((e) => e.id === copies[0].id)?.status === "cancelled",
                "the Bluz delete did not reach the shared calendar",
            );
        } finally {
            await request.delete("/api/event", { data: JSON.stringify(eventId) }).catch(() => undefined);
            if (previousSettings) {
                await request.post("/api/personal-settings", { data: previousSettings }).catch(() => undefined);
            }
            // Never leave either shared test user linked for the other specs.
            await request.post("/api/integrations/google-calendar/disconnect").catch(() => undefined);
            await secondary.post("/api/integrations/google-calendar/disconnect").catch(() => undefined);
            await stub.post("/__stub/reset").catch(() => undefined);
            await secondary.dispose();
            await stub.dispose();
        }
    });

    test("rejects a calendar the user cannot write to and unknown purge scopes", async ({
        request,
        playwright,
    }) => {
        const stub = await playwright.request.newContext({ baseURL: GOOGLE_STUB_URL });
        try {
            await stub.post("/__stub/reset");
            await stub.post("/__stub/shared-calendar", {
                data: { id: "read-only-cal", summary: "חגים", accessRole: "reader" },
            });
            await connectViaApi(request);

            const listed = await request.get("/api/integrations/google-calendar/calendars");
            expect(listed.ok()).toBeTruthy();
            const { calendars } = (await listed.json()).data as {
                calendars: Array<{ id: string }>;
            };
            expect(calendars.map((c) => c.id)).not.toContain("read-only-cal");

            const readOnly = await request.post("/api/integrations/google-calendar/calendars", {
                data: { calendarId: "read-only-cal" },
            });
            expect(readOnly.status()).toBe(400);

            const both = await request.post("/api/integrations/google-calendar/calendars", {
                data: { calendarId: "x", createNew: true },
            });
            expect(both.status()).toBe(400);

            const badScope = await request.post("/api/integrations/google-calendar/purge", {
                data: { scope: "everything" },
            });
            expect(badScope.status()).toBe(400);
        } finally {
            await request.post("/api/integrations/google-calendar/disconnect").catch(() => undefined);
            await stub.post("/__stub/reset").catch(() => undefined);
            await stub.dispose();
        }
    });
});
