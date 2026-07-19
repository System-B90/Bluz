import { calendar_v3, google } from "googleapis";

import { getMetaController } from "@/api-server/mongo-db-controller";
import { DbEventDocument } from "@/api-shared/types/event";
import { GoogleCalendarLink } from "@/api-shared/types/google-calendar";

/**
 * Two-way Google Calendar integration, scoped to what's safe to automate:
 *  - PUSH: the signed-in user's own Bluz events (as instructor/lecturer) are
 *    mirrored into a dedicated "Bluz" calendar Bluz creates in their Google
 *    account. Bluz stays the source of truth for structured fields (course,
 *    room, subject...) — those can't be authored from a plain Google event.
 *  - PULL: the user's existing Google busy blocks are read (free/busy) so
 *    Bluz can flag scheduling conflicts. Google-side edits are never written
 *    back into Bluz's structured event data.
 *
 * Entirely opt-in (personal setting) and entirely optional at the deployment
 * level: with no GOOGLE_CLIENT_ID/SECRET set, or with no network reachability
 * to Google, every method here is a safe no-op. Bluz must keep working in
 * offline / no-internet installs.
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI =
    process.env.GOOGLE_REDIRECT_URI ??
    (process.env.NEXTAUTH_URL
        ? `${process.env.NEXTAUTH_URL.replace(/\/$/, "")}/api/integrations/google-calendar/callback`
        : "");

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const BLUZ_CALENDAR_SUMMARY = "Bluz";

export function isGoogleCalendarConfigured(): boolean {
    return Boolean(
        GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI,
    );
}

function createOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
    );
}

/** Deterministic, idempotent Google event id derived from the Bluz event id. */
function toGoogleEventId(bluzEventId: string): string {
    return bluzEventId.replace(/-/g, "").toLowerCase();
}

function toGoogleEvent(event: DbEventDocument): calendar_v3.Schema$Event {
    return {
        id: toGoogleEventId(event.id),
        summary: event.name || event.type,
        description: event.notes || undefined,
        start: { dateTime: new Date(event.startTime).toISOString() },
        end: { dateTime: new Date(event.endTime).toISOString() },
        extendedProperties: { private: { bluzEventId: event.id } },
    };
}

async function getLink(userId: string): Promise<GoogleCalendarLink | null> {
    return await getMetaController().googleCalendarLinks.findOne({ userId });
}

async function saveLink(
    userId: string,
    update: Partial<GoogleCalendarLink>,
): Promise<void> {
    await getMetaController().googleCalendarLinks.updateOne(
        { userId },
        { $set: update },
        { upsert: true },
    );
}

export async function isGoogleCalendarConnected(
    userId: string,
): Promise<boolean> {
    return Boolean(await getLink(userId));
}

export function getGoogleAuthUrl(userId: string): string {
    const client = createOAuthClient();
    return client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
        state: userId,
    });
}

/**
 * Exchanges the OAuth `code` for tokens, creates (or finds) the dedicated
 * "Bluz" calendar in the user's account, and persists the link.
 */
export async function connectGoogleCalendar(
    userId: string,
    code: string,
): Promise<void> {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error(
            "Google did not return a refresh token — retry the consent flow (prompt=consent, access_type=offline should force one on first connect).",
        );
    }
    client.setCredentials(tokens);

    const calendarApi = google.calendar({ version: "v3", auth: client });
    const existing = await calendarApi.calendarList.list();
    const bluzCalendar = existing.data.items?.find(
        (c) => c.summary === BLUZ_CALENDAR_SUMMARY,
    );
    const calendarId =
        bluzCalendar?.id ??
        (
            await calendarApi.calendars.insert({
                requestBody: { summary: BLUZ_CALENDAR_SUMMARY },
            })
        ).data.id;
    if (!calendarId) {
        throw new Error("Failed to create the Bluz Google calendar.");
    }

    await saveLink(userId, {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date ?? Date.now(),
        calendarId,
        connectedAt: Date.now(),
    });
}

export async function disconnectGoogleCalendar(userId: string): Promise<void> {
    await getMetaController().googleCalendarLinks.deleteOne({ userId });
}

/** Authorized client for a linked user, refreshing (and persisting) the access token if needed. */
async function getAuthorizedClient(
    userId: string,
): Promise<{ auth: InstanceType<typeof google.auth.OAuth2>; link: GoogleCalendarLink } | null> {
    const link = await getLink(userId);
    if (!link) return null;

    const client = createOAuthClient();
    client.setCredentials({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
        expiry_date: link.expiryDate,
    });
    client.on("tokens", (tokens) => {
        void saveLink(userId, {
            ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
            ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
            ...(tokens.expiry_date ? { expiryDate: tokens.expiry_date } : {}),
        });
    });
    return { auth: client, link };
}

/**
 * Push a single Bluz event to the user's Bluz Google calendar. Silent no-op
 * when the integration isn't configured/connected, or when Google is
 * unreachable (offline-hosted deployments must never fail on this).
 */
export async function pushEventToGoogle(
    userId: string,
    event: DbEventDocument,
    action: "delete" | "upsert",
): Promise<void> {
    if (!isGoogleCalendarConfigured()) return;
    try {
        const authorized = await getAuthorizedClient(userId);
        if (!authorized) return;
        const calendarApi = google.calendar({
            version: "v3",
            auth: authorized.auth,
        });
        const eventId = toGoogleEventId(event.id);

        if (action === "delete") {
            await calendarApi.events
                .delete({ calendarId: authorized.link.calendarId, eventId })
                .catch((error: any) => {
                    if (error?.code !== 404 && error?.response?.status !== 404) {
                        throw error;
                    }
                });
            return;
        }

        const body = toGoogleEvent(event);
        await calendarApi.events
            .update({
                calendarId: authorized.link.calendarId,
                eventId,
                requestBody: body,
            })
            .catch(async (error: any) => {
                if (error?.code === 404 || error?.response?.status === 404) {
                    await calendarApi.events.insert({
                        calendarId: authorized.link.calendarId,
                        requestBody: body,
                    });
                    return;
                }
                throw error;
            });
    } catch (error) {
        // Never let a Google outage/misconfiguration break Bluz's own event flow.
        console.warn(
            `Google Calendar push skipped for user ${userId} (event ${event.id}):`,
            error,
        );
    }
}

/**
 * Pushes a full batch of the user's events (used by the manual "sync now"
 * action to backfill everything at once).
 */
export async function pushAllEvents(
    userId: string,
    events: Array<DbEventDocument>,
): Promise<number> {
    let pushed = 0;
    for (const event of events) {
        await pushEventToGoogle(userId, event, "upsert");
        pushed += 1;
    }
    return pushed;
}

/**
 * Reads the user's Google free/busy blocks over the next 30 days so Bluz can
 * surface external conflicts. Returns an empty array on any failure
 * (unconfigured, not connected, offline) rather than throwing.
 */
export async function pullBusyBlocks(
    userId: string,
): Promise<Array<{ start: string; end: string }>> {
    if (!isGoogleCalendarConfigured()) return [];
    try {
        const authorized = await getAuthorizedClient(userId);
        if (!authorized) return [];
        const calendarApi = google.calendar({
            version: "v3",
            auth: authorized.auth,
        });
        const timeMin = new Date().toISOString();
        const timeMax = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const response = await calendarApi.freebusy.query({
            requestBody: { timeMin, timeMax, items: [{ id: "primary" }] },
        });
        return (response.data.calendars?.primary?.busy ?? []).map((b) => ({
            start: b.start ?? "",
            end: b.end ?? "",
        }));
    } catch (error) {
        console.warn(`Google Calendar pull skipped for user ${userId}:`, error);
        return [];
    }
}
