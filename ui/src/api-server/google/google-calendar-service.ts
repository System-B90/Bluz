import { calendar_v3, google } from "googleapis";

import { DbEvent } from "@/api-server/db-event";
import { DbIterations } from "@/api-server/db-iterations";
import {
    getDatabaseController,
    resolveIterationDb,
} from "@/api-server/mongo-db-controller";
import { getMetaController } from "@/api-server/mongo-db-controller";
import { openSecret, sealSecret } from "@/api-server/secret-box";
import { DbEventDocument } from "@/api-shared/types/event";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { GoogleCalendarLink } from "@/api-shared/types/google-calendar";
import { IterationId } from "@/api-shared/types/iteration";

/**
 * Two-way Google Calendar integration:
 *  - PUSH: the signed-in user's own Bluz events (as instructor/lecturer) are
 *    mirrored into a dedicated "Bluz" calendar Bluz creates in their Google
 *    account.
 *  - PULL (edits): events Bluz pushed (tagged with `bluzEventId`) that were
 *    edited in Google Calendar are synced back into Bluz — title, notes,
 *    start/end. Events created directly in Google are never imported, and
 *    Bluz stays the source of truth for structured fields (course, room,
 *    subject...). Uses the Calendar API incremental-sync protocol
 *    (nextSyncToken / 410 GONE full resync).
 *  - PULL (busy): the user's Google free/busy blocks are read so Bluz can
 *    flag scheduling conflicts.
 *
 * Connect flow: the browser runs Google Identity Services ("Continue with
 * Google" popup, ux_mode: "popup") and posts the authorization code here.
 * Per Google's GIS code-model docs, a popup-mode code is exchanged with the
 * special redirect_uri `"postmessage"` (NOT the page origin) — so a
 * deployment needs NO redirect-URI registration and NO per-server OAuth
 * setup: Bluz ships shared app credentials below (env vars remain as
 * optional overrides).
 *
 * Entirely opt-in (personal setting) and entirely optional at the deployment
 * level: with no OAuth client configured, or with no network reachability
 * to Google, every method here is a safe no-op. Bluz must keep working in
 * offline / no-internet installs.
 */

// Bluz's shared OAuth app ("Bluz" project in Google Cloud). A GIS popup code
// flow uses no redirect URI, so one client works for every deployment whose
// origin is listed in the app's authorized JavaScript origins. Env vars
// override for self-hosters who want their own Google project.
const DEFAULT_GOOGLE_CLIENT_ID = "";
const DEFAULT_GOOGLE_CLIENT_SECRET = "";

const GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET =
    process.env.GOOGLE_CLIENT_SECRET || DEFAULT_GOOGLE_CLIENT_SECRET;

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
/** Name of the calendar created before it was named after the iteration (#482). */
const LEGACY_CALENDAR_SUMMARY = "Bluz";

/**
 * What the mirrored calendar is called in the user's Google account. A user
 * runs several iterations over the years, so "Bluz" said nothing about which
 * run the events belong to — the iteration's own label does (#482). Falls back
 * to the legacy name when no iteration is registered yet or the registry is
 * unreachable; naming must never be what breaks the connect flow.
 */
async function resolveCalendarSummary(): Promise<string> {
    try {
        const current = await DbIterations.currentOrNull();
        return current?.label || LEGACY_CALENDAR_SUMMARY;
    } catch {
        return LEGACY_CALENDAR_SUMMARY;
    }
}

export function isGoogleCalendarConfigured(): boolean {
    return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/** Public (non-secret) client id the browser needs to run the GIS popup. */
export function getGoogleClientId(): string {
    return GOOGLE_CLIENT_ID;
}

function createOAuthClient(
    redirectUri?: string,
): InstanceType<typeof google.auth.OAuth2> {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirectUri,
    );
}

/** Deterministic, idempotent Google event id derived from the Bluz event id. */
function toGoogleEventId(bluzEventId: string): string {
    return bluzEventId.replace(/-/g, "").toLowerCase();
}

function toGoogleEvent(
    event: DbEventDocument,
    iterationId?: IterationId,
): calendar_v3.Schema$Event {
    return {
        id: toGoogleEventId(event.id),
        summary: event.name || event.type,
        description: event.notes || undefined,
        start: { dateTime: new Date(event.startTime).toISOString() },
        end: { dateTime: new Date(event.endTime).toISOString() },
        extendedProperties: {
            // The iteration rides along so a pulled-back edit can be applied to
            // the database the event actually lives in. Without it the pull
            // resolved against the current iteration only, and silently dropped
            // every edit to an event in any other one (#538 item 6).
            private: {
                bluzEventId: event.id,
                ...(iterationId ? { bluzIterationId: iterationId } : {}),
            },
        },
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

/** Scopes the browser-side GIS popup must request. */
export function getGoogleScopes(): Array<string> {
    return SCOPES;
}

// GIS popup (ux_mode: "popup") code model: the browser has no redirect and
// the code must be redeemed against this reserved literal, not a real URL.
const GIS_POPUP_REDIRECT_URI = "postmessage";

/**
 * Exchanges the GIS popup authorization `code` for tokens, creates (or finds)
 * the dedicated "Bluz" calendar in the user's account, and persists the link.
 * The popup code model requires the reserved `"postmessage"` redirect_uri
 * during token exchange — passing the page origin fails with invalid_request.
 */
export async function connectGoogleCalendar(
    userId: string,
    code: string,
): Promise<void> {
    const client = createOAuthClient(GIS_POPUP_REDIRECT_URI);
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error(
            "Google did not return a refresh token — retry the consent flow (prompt=consent, access_type=offline should force one on first connect).",
        );
    }
    client.setCredentials(tokens);

    const calendarApi = google.calendar({ version: "v3", auth: client });
    const summary = await resolveCalendarSummary();
    const existing = await calendarApi.calendarList.list();
    // A reconnect must reuse the calendar it already filled, whether that was
    // named after the iteration or by the legacy "Bluz" name.
    const bluzCalendar = existing.data.items?.find(
        (c) => c.summary === summary || c.summary === LEGACY_CALENDAR_SUMMARY,
    );
    const calendarId =
        bluzCalendar?.id ??
        (
            await calendarApi.calendars.insert({ requestBody: { summary } })
        ).data.id;
    if (!calendarId) {
        throw new Error("Failed to create the Bluz Google calendar.");
    }

    // Adopt the iteration's name on an existing calendar too (a legacy one, or
    // one from before the iteration was renamed). A rename failure is cosmetic.
    if (bluzCalendar && bluzCalendar.summary !== summary) {
        await calendarApi.calendars
            .patch({ calendarId, requestBody: { summary } })
            .catch(() => undefined);
    }

    await saveLink(userId, {
        userId,
        accessToken: sealSecret(tokens.access_token),
        refreshToken: sealSecret(tokens.refresh_token),
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
        access_token: openSecret(link.accessToken),
        refresh_token: openSecret(link.refreshToken),
        expiry_date: link.expiryDate,
    });
    client.on("tokens", (tokens) => {
        void saveLink(userId, {
            ...(tokens.access_token ? { accessToken: sealSecret(tokens.access_token) } : {}),
            ...(tokens.refresh_token ? { refreshToken: sealSecret(tokens.refresh_token) } : {}),
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
    iterationId?: IterationId,
): Promise<boolean> {
    if (!isGoogleCalendarConfigured()) return false;
    try {
        const authorized = await getAuthorizedClient(userId);
        if (!authorized) return false;
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
            return true;
        }

        const body = toGoogleEvent(event, iterationId);
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
        return true;
    } catch (error) {
        // Never let a Google outage/misconfiguration break Bluz's own event flow.
        console.warn(
            `Google Calendar push skipped for user ${userId} (event ${event.id}):`,
            error,
        );
        return false;
    }
}

/**
 * Pushes a full batch of the user's events (used by the manual "sync now"
 * action to backfill everything at once).
 */
export async function pushAllEvents(
    userId: string,
    events: Array<DbEventDocument>,
    iterationId?: IterationId,
): Promise<number> {
    let pushed = 0;
    for (const event of events) {
        // Count what actually reached Google. Counting attempts reported a
        // full successful sync even when every push was silently swallowed
        // (#538 item 6).
        if (await pushEventToGoogle(userId, event, "upsert", iterationId)) {
            pushed += 1;
        }
    }
    return pushed;
}

/**
 * Applies one Google-side edit back onto the matching Bluz event. Only events
 * Bluz itself pushed carry `bluzEventId`; anything else is ignored, so events
 * authored directly in Google can never leak into Bluz.
 * Returns true when a Bluz event was actually updated.
 */
async function applyGoogleEdit(
    googleEvent: calendar_v3.Schema$Event,
): Promise<boolean> {
    const bluzEventId = googleEvent.extendedProperties?.private?.bluzEventId;
    if (!bluzEventId) return false;
    // Deleting the mirrored copy in Google is not a Bluz delete — Bluz stays
    // the source of truth for an event's existence. The next push recreates it.
    if (googleEvent.status === "cancelled") return false;

    // Resolve the event in the iteration it belongs to, not whichever is
    // current (#538 item 6). Events pushed before this tag existed carry no
    // iteration and fall back to the current one, as before.
    const taggedIteration =
        googleEvent.extendedProperties?.private?.bluzIterationId;
    const controller = taggedIteration
        ? await resolveIterationDb(taggedIteration as IterationId).then(
            ({ dbName }) => getDatabaseController(dbName),
        )
        : undefined;

    const existing = await DbEvent.get(bluzEventId, undefined, controller);
    if (!existing) return false;

    const startRaw = googleEvent.start?.dateTime ?? googleEvent.start?.date;
    const endRaw = googleEvent.end?.dateTime ?? googleEvent.end?.date;
    const updated: DbEventDocument = {
        ...existing,
        name: googleEvent.summary ?? existing.name,
        notes: googleEvent.description ?? "",
        startTime: startRaw ? new Date(startRaw) : existing.startTime,
        endTime: endRaw ? new Date(endRaw) : existing.endTime,
    };

    const changed =
        updated.name !== existing.name ||
        updated.notes !== (existing.notes ?? "") ||
        new Date(updated.startTime as any).getTime() !==
            new Date(existing.startTime as any).getTime() ||
        new Date(updated.endTime as any).getTime() !==
            new Date(existing.endTime as any).getTime();
    if (!changed) return false;

    await DbEvent.set(updated, undefined, controller, undefined, {
        initiator: EventChangeInitiator.GoogleSync,
    });
    return true;
}

/**
 * Pulls Google-side edits from the user's Bluz calendar back into Bluz using
 * the Calendar API incremental-sync protocol: the first call does a full list
 * and stores `nextSyncToken`; later calls send that token and receive only
 * what changed since. A 410 GONE (expired token) clears the cursor and
 * retries with a full resync, per Google's docs.
 * Returns the number of Bluz events updated; 0 (never throws) on any failure.
 */
export async function pullEventEdits(userId: string): Promise<number> {
    if (!isGoogleCalendarConfigured()) return 0;
    try {
        const authorized = await getAuthorizedClient(userId);
        if (!authorized) return 0;
        const calendarApi = google.calendar({
            version: "v3",
            auth: authorized.auth,
        });

        const listPage = (syncToken?: string, pageToken?: string) =>
            calendarApi.events.list({
                calendarId: authorized.link.calendarId,
                singleEvents: false,
                showDeleted: true,
                ...(syncToken ? { syncToken } : {}),
                ...(pageToken ? { pageToken } : {}),
            });

        let syncToken = authorized.link.syncToken;
        let pageToken: string | undefined;
        let updatedCount = 0;
        let nextSyncToken: string | undefined;

        do {
            let response;
            try {
                response = await listPage(syncToken, pageToken);
            } catch (error: any) {
                const status = error?.code ?? error?.response?.status;
                if (status === 410 && syncToken) {
                    // Expired sync token: restart with a full resync.
                    syncToken = undefined;
                    pageToken = undefined;
                    response = await listPage();
                } else {
                    throw error;
                }
            }
            for (const item of response.data.items ?? []) {
                if (await applyGoogleEdit(item)) updatedCount += 1;
            }
            pageToken = response.data.nextPageToken ?? undefined;
            nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
        } while (pageToken);

        if (nextSyncToken) {
            await saveLink(userId, { syncToken: nextSyncToken });
        }
        return updatedCount;
    } catch (error) {
        console.warn(
            `Google Calendar edit pull skipped for user ${userId}:`,
            error,
        );
        return 0;
    }
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
