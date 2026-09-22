import { calendar_v3, google } from "googleapis";

import { DbEvent } from "@/api-server/db-event";
import { DbIterations } from "@/api-server/db-iterations";
import {
    calendarWantsEvent,
    GoogleSyncSubscriber,
} from "@/api-server/google/google-calendar-scope";
import {
    DatabaseController,
    getDatabaseController,
    getMetaController,
    resolveIterationDb,
} from "@/api-server/mongo-db-controller";
import { openSecret, sealSecret } from "@/api-server/secret-box";
import { ClientApiError } from "@/api-shared/errors";
import { DbEventDocument } from "@/api-shared/types/event";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import {
    ApiGoogleCalendarPurgeResponse,
    ApiGoogleCalendarSelectPayload,
    GoogleCalendarAccessRole,
    GoogleCalendarLink,
    GoogleCalendarOption,
    GoogleCalendarPurgeScope,
    GoogleCalendarSelection,
} from "@/api-shared/types/google-calendar";
import { IterationId } from "@/api-shared/types/iteration";
import { logger } from "@/logging/pino";

/**
 * Two-way Google Calendar integration:
 *  - PUSH: the signed-in user's own Bluz events (as instructor/lecturer) are
 *    mirrored into a Google calendar — one Bluz creates in their account, or
 *    one a colleague owns and shared with them. Several users may mirror into
 *    the same shared calendar; the fan-out (google-calendar-sync.ts) groups
 *    links by calendar so every event lands there once, and each link pins
 *    the Bluz iteration that calendar represents.
 *  - PULL (edits): events Bluz pushed (tagged with `bluzEventId`) that were
 *    edited in Google Calendar are synced back into Bluz — title, notes,
 *    start/end. Events created directly in Google are never imported, and
 *    Bluz stays the source of truth for structured fields (course, room,
 *    subject...). Uses the Calendar API incremental-sync protocol
 *    (nextSyncToken / 410 GONE full resync).
 *  - PULL (busy): the user's Google free/busy blocks are read so Bluz can
 *    flag scheduling conflicts.
 *  - PURGE: Bluz-tagged Google events that no longer correspond to a live,
 *    in-scope Bluz event of the calendar's iteration can be removed on
 *    demand ("orphaned"), or all of them at once ("all").
 *
 * Connect flow: the browser runs Google Identity Services ("Continue with
 * Google" popup, ux_mode: "popup") and posts the authorization code here.
 * Per Google's GIS code-model docs, a popup-mode code is exchanged with the
 * special redirect_uri `"postmessage"` (NOT the page origin) — so a
 * deployment needs NO redirect-URI registration and NO per-server OAuth
 * setup: Bluz ships shared app credentials below (env vars remain as
 * optional overrides).
 *
 * Google API conduct (developers.google.com/workspace/calendar/api/guides/
 * errors, /quota): every Calendar call goes through {@link withBackoff},
 * which retries 403 rate-limit / 429 / 5xx with truncated exponential
 * backoff plus jitter and never retries other 4xx client errors. Event ids
 * are client-supplied base32hex derived from the Bluz id, so a push is
 * idempotent: update first, insert on 404, and update again on a 409
 * "identifier already exists" (a previously deleted copy still holds the
 * id). Pulls send `syncToken` with the same parameter set as the full sync
 * (only `showDeleted`/`singleEvents`, which the protocol allows).
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

// Test-topology overrides that point the integration at a stub instead of
// Google (#579). Unset in every real deployment, where the libraries' own
// Google endpoints apply.
const GOOGLE_OAUTH_TOKEN_URL = process.env.GOOGLE_OAUTH_TOKEN_URL || undefined;
const GOOGLE_API_ROOT_URL = process.env.GOOGLE_API_ROOT_URL || undefined;

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
/** Name of the calendar created before it was named after the iteration (#482). */
const LEGACY_CALENDAR_SUMMARY = "Bluz";
/** Largest page the Calendar API allows on events.list. */
const EVENTS_PAGE_SIZE = 2500;
/** Marks a Google event as Bluz-managed (queryable via privateExtendedProperty). */
const BLUZ_MANAGED_TAG = "bluzManaged";

// ---------------------------------------------------------------------------
// Retry / backoff
// ---------------------------------------------------------------------------

/**
 * Retry policy for Calendar API calls. Mutable so tests can zero the delays;
 * production keeps Google's recommended truncated exponential backoff.
 */
export const googleRetryPolicy = {
    /** Total attempts, including the first. */
    attempts: 4,
    baseDelayMs: 500,
    maxDelayMs: 8_000,
};

type GoogleApiError = {
    code?: number | string;
    response?: { status?: number };
    errors?: Array<{ reason?: string }>;
};

/** HTTP status of a googleapis/gaxios rejection, when it has one. */
export function googleErrorStatus(error: unknown): number | undefined {
    const e = error as GoogleApiError | undefined;
    const raw = e?.response?.status ?? e?.code;
    const status = typeof raw === "string" ? Number(raw) : raw;
    return typeof status === "number" && Number.isFinite(status)
        ? status
        : undefined;
}

function isRateLimit403(error: unknown): boolean {
    const reasons = (error as GoogleApiError)?.errors ?? [];
    return reasons.some((r) => /rateLimit/i.test(r.reason ?? ""));
}

/**
 * Per Google's error guide: back off on 429, 5xx and the two 403 rate-limit
 * reasons; never on other 4xx (400/401/403-forbidden/404/409/410/412), which
 * the caller must handle semantically.
 */
export function isRetryableGoogleError(error: unknown): boolean {
    const status = googleErrorStatus(error);
    if (status === undefined) return false;
    if (status === 429 || status >= 500) return true;
    return status === 403 && isRateLimit403(error);
}

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs one Calendar API call with truncated exponential backoff + jitter. */
export async function withBackoff<T>(call: () => Promise<T>): Promise<T> {
    const { attempts, baseDelayMs, maxDelayMs } = googleRetryPolicy;
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await call();
        } catch (error) {
            if (attempt + 1 >= attempts || !isRetryableGoogleError(error)) {
                throw error;
            }
            const delay = Math.min(
                baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs,
                maxDelayMs,
            );
            await sleep(delay);
        }
    }
}

// ---------------------------------------------------------------------------
// Configuration + clients
// ---------------------------------------------------------------------------

/**
 * The current iteration, and what a Bluz-created calendar is called in the
 * user's Google account. A user runs several iterations over the years, so
 * "Bluz" said nothing about which run the events belong to — the iteration's
 * own label does (#482). Falls back to the legacy name when no iteration is
 * registered yet or the registry is unreachable; naming must never be what
 * breaks the connect flow.
 */
async function resolveCurrentIteration(): Promise<{
    id?: IterationId;
    summary: string;
}> {
    try {
        const current = await DbIterations.currentOrNull();
        return {
            id: current?.id,
            summary: current?.label || LEGACY_CALENDAR_SUMMARY,
        };
    } catch {
        return { summary: LEGACY_CALENDAR_SUMMARY };
    }
}

export function isGoogleCalendarConfigured(): boolean {
    return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/** Public (non-secret) client id the browser needs to run the GIS popup. */
export function getGoogleClientId(): string {
    return GOOGLE_CLIENT_ID;
}

/** Scopes the browser-side GIS popup must request. */
export function getGoogleScopes(): Array<string> {
    return SCOPES;
}

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

function createOAuthClient(redirectUri?: string): OAuth2Client {
    // `endpoints` is read-only on the constructed client, so the stub's token
    // URL has to go in through the constructor — assigning it afterwards left
    // the client talking to the real oauth2.googleapis.com and every e2e
    // connect failed with `invalid_client`.
    return new google.auth.OAuth2({
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        redirectUri,
        ...(GOOGLE_OAUTH_TOKEN_URL
            ? { endpoints: { oauth2TokenUrl: GOOGLE_OAUTH_TOKEN_URL } }
            : {}),
    });
}

/** Calendar API client, honouring the test stub's root URL when set. */
function calendarFor(auth: OAuth2Client): calendar_v3.Calendar {
    return google.calendar({
        version: "v3",
        auth,
        ...(GOOGLE_API_ROOT_URL ? { rootUrl: GOOGLE_API_ROOT_URL } : {}),
    });
}

/**
 * Deterministic, idempotent Google event id derived from the Bluz event id.
 * Bluz ids are UUIDs / Mongo ObjectIds, so stripping dashes leaves lowercase
 * hex — a subset of the base32hex alphabet (a-v, 0-9) Google requires.
 */
export function toGoogleEventId(bluzEventId: string): string {
    return bluzEventId.replace(/-/g, "").toLowerCase();
}

function toGoogleEvent(
    event: DbEventDocument,
    iterationId?: IterationId,
): calendar_v3.Schema$Event {
    return {
        id: toGoogleEventId(event.id),
        // Explicit: an update onto a copy the user deleted in Google (still
        // held as "cancelled" under the same id) revives it instead of
        // silently updating a tombstone.
        status: "confirmed",
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
                [BLUZ_MANAGED_TAG]: "true",
                bluzEventId: event.id,
                ...(iterationId ? { bluzIterationId: iterationId } : {}),
            },
        },
    };
}

// ---------------------------------------------------------------------------
// Link storage
// ---------------------------------------------------------------------------

async function getLink(userId: string): Promise<GoogleCalendarLink | null> {
    return await getMetaController().googleCalendarLinks.findOne({ userId });
}

async function saveLink(
    userId: string,
    update: Partial<GoogleCalendarLink>,
    unset: Array<keyof GoogleCalendarLink> = [],
): Promise<void> {
    await getMetaController().googleCalendarLinks.updateOne(
        { userId },
        {
            $set: update,
            ...(unset.length
                ? { $unset: Object.fromEntries(unset.map((k) => [k, ""])) }
                : {}),
        },
        { upsert: true },
    );
}

export async function isGoogleCalendarConnected(
    userId: string,
): Promise<boolean> {
    return Boolean(await getLink(userId));
}

/** The links of the given users, for the fan-out to group by calendar. */
export async function listGoogleCalendarLinks(
    userIds: Array<string>,
): Promise<Array<GoogleCalendarLink>> {
    if (!userIds.length) return [];
    return await getMetaController()
        .googleCalendarLinks.find({ userId: { $in: userIds } })
        .toArray();
}

async function countLinksToCalendar(calendarId: string): Promise<number> {
    return await getMetaController().googleCalendarLinks.countDocuments({
        calendarId,
    });
}

/** Client-safe description of the user's linked calendar, or null. */
export async function getGoogleCalendarSelection(
    userId: string,
): Promise<GoogleCalendarSelection | null> {
    const link = await getLink(userId);
    if (!link) return null;
    return await describeSelection(link);
}

async function describeSelection(
    link: GoogleCalendarLink,
): Promise<GoogleCalendarSelection> {
    const [linkedUsers, iteration] = await Promise.all([
        countLinksToCalendar(link.calendarId),
        link.iterationId
            ? DbIterations.get(link.iterationId).catch(() => null)
            : Promise.resolve(null),
    ]);
    return {
        id: link.calendarId,
        summary: link.calendarSummary ?? LEGACY_CALENDAR_SUMMARY,
        accessRole: link.calendarAccessRole,
        iterationId: link.iterationId,
        iterationLabel: iteration?.label,
        linkedUsers,
    };
}

// ---------------------------------------------------------------------------
// Connect / disconnect / choose calendar
// ---------------------------------------------------------------------------

// GIS popup (ux_mode: "popup") code model: the browser has no redirect and
// the code must be redeemed against this reserved literal, not a real URL.
const GIS_POPUP_REDIRECT_URI = "postmessage";

const WRITABLE_ROLES: ReadonlySet<string> = new Set(["owner", "writer"]);

function toCalendarOption(
    entry: calendar_v3.Schema$CalendarListEntry,
): GoogleCalendarOption | null {
    if (!entry.id) return null;
    // Entries with no role (older stubs/fakes) are assumed the user's own;
    // explicit read-only roles are dropped — Bluz cannot mirror into them.
    const accessRole = (entry.accessRole ?? "owner") as GoogleCalendarAccessRole;
    if (!WRITABLE_ROLES.has(accessRole)) return null;
    return {
        id: entry.id,
        summary: entry.summaryOverride || entry.summary || entry.id,
        accessRole,
        primary: Boolean(entry.primary),
        shared: accessRole !== "owner",
    };
}

/** Calendars the user can write to, following calendarList pagination. */
async function listWritableCalendars(
    calendarApi: calendar_v3.Calendar,
): Promise<Array<GoogleCalendarOption>> {
    const options: Array<GoogleCalendarOption> = [];
    let pageToken: string | undefined;
    do {
        const response = await withBackoff(() =>
            calendarApi.calendarList.list({
                minAccessRole: "writer",
                maxResults: 250,
                ...(pageToken ? { pageToken } : {}),
            }),
        );
        for (const entry of response.data.items ?? []) {
            const option = toCalendarOption(entry);
            if (option) options.push(option);
        }
        pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    return options;
}

/**
 * Picks the calendar a connect should mirror into: one already named after
 * the iteration (owned *or* shared — that is how staff share a single
 * calendar), else the legacy "Bluz" one, else nothing (caller creates).
 * Owned calendars win over shared ones with the same name.
 */
function findCalendarBySummary(
    calendars: Array<GoogleCalendarOption>,
    summary: string,
): GoogleCalendarOption | undefined {
    const byName = (name: string) =>
        calendars.find((c) => c.summary === name && !c.shared) ??
        calendars.find((c) => c.summary === name);
    return byName(summary) ?? byName(LEGACY_CALENDAR_SUMMARY);
}

async function createBluzCalendar(
    calendarApi: calendar_v3.Calendar,
    summary: string,
): Promise<GoogleCalendarOption> {
    const created = await withBackoff(() =>
        calendarApi.calendars.insert({ requestBody: { summary } }),
    );
    if (!created.data.id) {
        throw new Error("Failed to create the Bluz Google calendar.");
    }
    return {
        id: created.data.id,
        summary,
        accessRole: "owner",
        primary: false,
        shared: false,
    };
}

/**
 * Exchanges the GIS popup authorization `code` for tokens, finds (or creates)
 * the calendar for the current iteration in the user's account, and persists
 * the link. The popup code model requires the reserved `"postmessage"`
 * redirect_uri during token exchange — passing the page origin fails with
 * invalid_request.
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

    const calendarApi = calendarFor(client);
    const iteration = await resolveCurrentIteration();
    // A reconnect must reuse the calendar it already filled, whether that was
    // named after the iteration or by the legacy "Bluz" name — and a calendar
    // a colleague shared under the iteration's name is picked up the same way.
    const existing = findCalendarBySummary(
        await listWritableCalendars(calendarApi),
        iteration.summary,
    );
    const calendar =
        existing ?? (await createBluzCalendar(calendarApi, iteration.summary));

    // Adopt the iteration's name on an existing calendar too (a legacy one, or
    // one from before the iteration was renamed). Only on calendars the user
    // owns — renaming someone else's shared calendar is not Bluz's call. A
    // rename failure is cosmetic.
    if (existing && !existing.shared && existing.summary !== iteration.summary) {
        await calendarApi.calendars
            .patch({
                calendarId: calendar.id,
                requestBody: { summary: iteration.summary },
            })
            .catch(() => undefined);
        calendar.summary = iteration.summary;
    }

    await saveLink(
        userId,
        {
            userId,
            accessToken: sealSecret(tokens.access_token),
            refreshToken: sealSecret(tokens.refresh_token),
            expiryDate: tokens.expiry_date ?? Date.now(),
            calendarId: calendar.id,
            calendarSummary: calendar.summary,
            calendarAccessRole: calendar.accessRole,
            ...(iteration.id ? { iterationId: iteration.id } : {}),
            connectedAt: Date.now(),
        },
        // A reconnect onto a (possibly different) calendar must not replay a
        // cursor from the previous one.
        ["syncToken"],
    );
}

export async function disconnectGoogleCalendar(userId: string): Promise<void> {
    await getMetaController().googleCalendarLinks.deleteOne({ userId });
}

type Authorized = { auth: OAuth2Client; link: GoogleCalendarLink };

/** Authorized client for a linked user, refreshing (and persisting) the access token if needed. */
async function getAuthorizedClient(userId: string): Promise<Authorized | null> {
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

/** Requires a link; a route-level error when the user never connected. */
async function requireAuthorized(userId: string): Promise<Authorized> {
    const authorized = await getAuthorizedClient(userId);
    if (!authorized) {
        throw new ClientApiError("חשבון Google אינו מחובר");
    }
    return authorized;
}

/**
 * Calendars the connected user could mirror into — their own plus any a
 * colleague shared with write access. Throws when not connected.
 */
export async function listGoogleCalendarOptions(
    userId: string,
): Promise<{ calendars: Array<GoogleCalendarOption>; selectedId: string }> {
    const { auth, link } = await requireAuthorized(userId);
    const calendars = await listWritableCalendars(calendarFor(auth));
    return { calendars, selectedId: link.calendarId };
}

/**
 * Re-points the user's link at another calendar (an existing writable one,
 * typically shared by a colleague, or a fresh Bluz-created one). The sync
 * cursor is dropped — it belonged to the previous calendar — and the link's
 * iteration is reset to the current one, which is what the new calendar will
 * mirror from now on.
 */
export async function selectGoogleCalendar(
    userId: string,
    payload: ApiGoogleCalendarSelectPayload,
): Promise<GoogleCalendarSelection> {
    const { auth, link } = await requireAuthorized(userId);
    const calendarApi = calendarFor(auth);
    const iteration = await resolveCurrentIteration();

    let calendar: GoogleCalendarOption;
    if ("createNew" in payload && payload.createNew) {
        calendar = await createBluzCalendar(calendarApi, iteration.summary);
    } else {
        const calendarId =
            "calendarId" in payload ? payload.calendarId?.trim() : "";
        if (!calendarId) throw new ClientApiError("Missing calendarId.");
        const entry = await withBackoff(() =>
            calendarApi.calendarList.get({ calendarId }),
        ).catch((error) => {
            // 403: a calendar the account can see but not use.
            const status = googleErrorStatus(error);
            if (status === 404 || status === 403) return null;
            throw error;
        });
        const option = entry?.data ? toCalendarOption(entry.data) : null;
        if (!option) {
            throw new ClientApiError(
                "היומן שנבחר אינו קיים בחשבון Google או שאין בו הרשאת כתיבה",
            );
        }
        calendar = option;
    }

    const changes: Partial<GoogleCalendarLink> = {
        calendarId: calendar.id,
        calendarSummary: calendar.summary,
        calendarAccessRole: calendar.accessRole,
        ...(iteration.id ? { iterationId: iteration.id } : {}),
    };
    await saveLink(
        userId,
        changes,
        iteration.id ? ["syncToken"] : ["syncToken", "iterationId"],
    );
    const { syncToken: _dropped, iterationId: _prev, ...rest } = link;
    void _dropped;
    void _prev;
    return await describeSelection({ ...rest, ...changes });
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/**
 * Push a single Bluz event to the user's linked Google calendar. Silent no-op
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
        const calendarApi = calendarFor(authorized.auth);
        const calendarId = authorized.link.calendarId;
        const eventId = toGoogleEventId(event.id);

        if (action === "delete") {
            await withBackoff(() =>
                calendarApi.events.delete({ calendarId, eventId }),
            ).catch((error) => {
                // Already gone (404), or a tombstone Google refuses to delete
                // twice (410) — both mean "not there", which is the goal.
                const status = googleErrorStatus(error);
                if (status !== 404 && status !== 410) throw error;
            });
            return true;
        }

        const requestBody = toGoogleEvent(event, iterationId);
        const update = () =>
            withBackoff(() =>
                calendarApi.events.update({ calendarId, eventId, requestBody }),
            );
        await update().catch(async (error) => {
            if (googleErrorStatus(error) !== 404) throw error;
            await withBackoff(() =>
                calendarApi.events.insert({ calendarId, requestBody }),
            ).catch(async (insertError) => {
                // 409 "identifier already exists": the id is held by a copy
                // in a state update could not see (a race with a concurrent
                // push, or a tombstone) — an update onto it is the fix Google
                // prescribes for this error.
                if (googleErrorStatus(insertError) !== 409) throw insertError;
                await update();
            });
        });
        return true;
    } catch (error) {
        // Never let a Google outage/misconfiguration break Bluz's own event flow.
        logger.warn({ err: error }, `Google Calendar push skipped for user ${userId} (event ${event.id}):`);
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

// ---------------------------------------------------------------------------
// Pull (edits)
// ---------------------------------------------------------------------------

/**
 * Resolves which Bluz database a Google copy's edit belongs to: the iteration
 * tagged on the event, else the iteration the link is bound to, else (legacy
 * links and copies) the current one.
 */
async function controllerForGoogleCopy(
    googleEvent: calendar_v3.Schema$Event,
    link: GoogleCalendarLink,
): Promise<DatabaseController | undefined> {
    const iterationId =
        googleEvent.extendedProperties?.private?.bluzIterationId ??
        link.iterationId;
    if (!iterationId) return undefined;
    const { dbName } = await resolveIterationDb(iterationId as IterationId);
    return getDatabaseController(dbName);
}

/**
 * Applies one Google-side edit back onto the matching Bluz event. Only events
 * Bluz itself pushed carry `bluzEventId`; anything else is ignored, so events
 * authored directly in Google can never leak into Bluz.
 * Returns true when a Bluz event was actually updated.
 */
async function applyGoogleEdit(
    googleEvent: calendar_v3.Schema$Event,
    link: GoogleCalendarLink,
): Promise<boolean> {
    const bluzEventId = googleEvent.extendedProperties?.private?.bluzEventId;
    if (!bluzEventId) return false;
    // Deleting the mirrored copy in Google is not a Bluz delete — Bluz stays
    // the source of truth for an event's existence. The next push recreates it.
    if (googleEvent.status === "cancelled") return false;

    // Resolve the event in the iteration it belongs to, not whichever is
    // current (#538 item 6).
    const controller = await controllerForGoogleCopy(googleEvent, link);
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
 * Pulls Google-side edits from the user's linked calendar back into Bluz
 * using the Calendar API incremental-sync protocol: the first call does a
 * full list and stores `nextSyncToken`; later calls send that token and
 * receive only what changed since. A 410 GONE (expired token) clears the
 * cursor and retries with a full resync, per Google's docs.
 * Returns the number of Bluz events updated; 0 (never throws) on any failure.
 */
export async function pullEventEdits(userId: string): Promise<number> {
    if (!isGoogleCalendarConfigured()) return 0;
    try {
        const authorized = await getAuthorizedClient(userId);
        if (!authorized) return 0;
        const calendarApi = calendarFor(authorized.auth);
        const { link } = authorized;

        // The same parameter set on the full and every incremental sync —
        // the protocol rejects a syncToken paired with filters it did not
        // start with.
        const listPage = (syncToken?: string, pageToken?: string) =>
            withBackoff(() =>
                calendarApi.events.list({
                    calendarId: link.calendarId,
                    singleEvents: false,
                    showDeleted: true,
                    maxResults: EVENTS_PAGE_SIZE,
                    ...(syncToken ? { syncToken } : {}),
                    ...(pageToken ? { pageToken } : {}),
                }),
            );

        let syncToken = link.syncToken;
        let pageToken: string | undefined;
        let updatedCount = 0;
        let nextSyncToken: string | undefined;

        do {
            let response;
            try {
                response = await listPage(syncToken, pageToken);
            } catch (error) {
                if (googleErrorStatus(error) === 410 && syncToken) {
                    // Expired sync token: restart with a full resync.
                    syncToken = undefined;
                    pageToken = undefined;
                    response = await listPage();
                } else {
                    throw error;
                }
            }
            for (const item of response.data.items ?? []) {
                if (await applyGoogleEdit(item, link)) updatedCount += 1;
            }
            pageToken = response.data.nextPageToken ?? undefined;
            nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
        } while (pageToken);

        if (nextSyncToken) {
            await saveLink(userId, { syncToken: nextSyncToken });
        }
        return updatedCount;
    } catch (error) {
        logger.warn({ err: error }, `Google Calendar edit pull skipped for user ${userId}:`);
        return 0;
    }
}

// ---------------------------------------------------------------------------
// Pull (busy)
// ---------------------------------------------------------------------------

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
        const calendarApi = calendarFor(authorized.auth);
        const timeMin = new Date().toISOString();
        const timeMax = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const response = await withBackoff(() =>
            calendarApi.freebusy.query({
                requestBody: { timeMin, timeMax, items: [{ id: "primary" }] },
            }),
        );
        return (response.data.calendars?.primary?.busy ?? []).map((b) => ({
            start: b.start ?? "",
            end: b.end ?? "",
        }));
    } catch (error) {
        logger.warn({ err: error }, `Google Calendar pull skipped for user ${userId}:`);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Purge
// ---------------------------------------------------------------------------

/** Every Bluz-tagged, non-cancelled event in the calendar. */
async function listBluzManagedEvents(
    calendarApi: calendar_v3.Calendar,
    calendarId: string,
): Promise<Array<calendar_v3.Schema$Event>> {
    const items: Array<calendar_v3.Schema$Event> = [];
    let pageToken: string | undefined;
    do {
        const response = await withBackoff(() =>
            calendarApi.events.list({
                calendarId,
                singleEvents: false,
                showDeleted: false,
                maxResults: EVENTS_PAGE_SIZE,
                ...(pageToken ? { pageToken } : {}),
            }),
        );
        for (const item of response.data.items ?? []) {
            // Only what Bluz pushed. Copies from before `bluzManaged` existed
            // still carry `bluzEventId`, so that tag is the discriminator.
            if (item.id && item.extendedProperties?.private?.bluzEventId) {
                items.push(item);
            }
        }
        pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    return items;
}

/** Users mirroring into `calendarId` who have sync switched on. */
async function subscribersOfCalendar(
    calendarId: string,
): Promise<Array<GoogleSyncSubscriber>> {
    const meta = getMetaController();
    const links = await meta.googleCalendarLinks.find({ calendarId }).toArray();
    const settings = await meta.personalSettings
        .find({
            userId: { $in: links.map((l) => l.userId) },
            googleCalendarEnabled: true,
        })
        .toArray();
    return settings.map((s) => ({
        userId: s.userId,
        syncAllEvents: Boolean(s.googleCalendarSyncAllEvents),
    }));
}

/**
 * Which of the Bluz-tagged Google copies are orphans: their Bluz event is
 * gone (deleted/archived), lives in a different iteration than the calendar
 * mirrors, or is no longer in any linked user's sync scope.
 */
async function findOrphans(
    copies: Array<calendar_v3.Schema$Event>,
    link: GoogleCalendarLink,
): Promise<Array<calendar_v3.Schema$Event>> {
    const calendarIteration = link.iterationId;
    const subscribers = await subscribersOfCalendar(link.calendarId);
    // No subscriber (sync switched off) means no event is "wanted" — treating
    // that as "everything is an orphan" would wipe the calendar.
    if (!subscribers.length) return [];

    // Group by the iteration each copy claims, so one Mongo lookup per DB.
    const byIteration = new Map<string, Array<calendar_v3.Schema$Event>>();
    const orphans: Array<calendar_v3.Schema$Event> = [];
    for (const copy of copies) {
        const tagged = copy.extendedProperties?.private?.bluzIterationId;
        if (calendarIteration && tagged && tagged !== calendarIteration) {
            orphans.push(copy);
            continue;
        }
        const key = tagged ?? calendarIteration ?? "";
        byIteration.set(key, [...(byIteration.get(key) ?? []), copy]);
    }

    for (const [iterationId, group] of byIteration) {
        const controller = iterationId
            ? await resolveIterationDb(iterationId as IterationId).then(
                ({ dbName }) => getDatabaseController(dbName),
            )
            : undefined;
        const ids = group.map(
            (c) => c.extendedProperties!.private!.bluzEventId,
        );
        const live = new Map(
            (await DbEvent.getMultiple(ids, undefined, controller)).map(
                (e) => [e.id, e],
            ),
        );
        for (const copy of group) {
            const event = live.get(copy.extendedProperties!.private!.bluzEventId);
            if (!event || !calendarWantsEvent(event, subscribers)) {
                orphans.push(copy);
            }
        }
    }
    return orphans;
}

/**
 * Removes Bluz-tagged events from the user's linked Google calendar — the
 * orphaned ones, or all of them. Never touches events created by hand in
 * Google. Deletes run sequentially with backoff; one that still fails is
 * counted, not thrown, so the rest of the purge completes.
 */
export async function purgeGoogleEvents(
    userId: string,
    scope: GoogleCalendarPurgeScope,
): Promise<ApiGoogleCalendarPurgeResponse> {
    const { auth, link } = await requireAuthorized(userId);
    const calendarApi = calendarFor(auth);

    const copies = await listBluzManagedEvents(calendarApi, link.calendarId);
    const targets = scope === "all" ? copies : await findOrphans(copies, link);

    let removed = 0;
    let failed = 0;
    for (const copy of targets) {
        try {
            await withBackoff(() =>
                calendarApi.events.delete({
                    calendarId: link.calendarId,
                    eventId: copy.id!,
                }),
            );
            removed += 1;
        } catch (error) {
            const status = googleErrorStatus(error);
            if (status === 404 || status === 410) {
                removed += 1;
                continue;
            }
            failed += 1;
            logger.warn(
                { err: error },
                `Google Calendar purge could not delete ${copy.id} for user ${userId}:`,
            );
        }
    }
    return { scanned: copies.length, removed, failed };
}
