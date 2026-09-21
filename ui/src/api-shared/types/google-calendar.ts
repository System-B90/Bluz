import { IterationId } from "@/api-shared/types/iteration";

/**
 * Per-user OAuth link to Google Calendar. Stored server-side only — never sent
 * to the client as-is (see {@link GoogleCalendarStatus}).
 *
 * Several users may point their links at the *same* Google calendar (one
 * shared by its owner with the rest of the staff). The sync fan-out groups
 * links by `calendarId` so a shared calendar receives each event once, and
 * the link's `iterationId` pins which Bluz iteration that calendar mirrors.
 */
export type GoogleCalendarLink = {
    userId: string;
    /** AES-GCM sealed (see api-server/secret-box.ts) — never stored in plaintext. */
    accessToken: string;
    /** AES-GCM sealed (see api-server/secret-box.ts) — never stored in plaintext. */
    refreshToken: string;
    /** Epoch ms when `accessToken` expires. */
    expiryDate: number;
    /** Google calendar this link mirrors into — Bluz-created, or one shared with the user. */
    calendarId: string;
    /** Display name of that calendar at link time (cosmetic; Google is the source of truth). */
    calendarSummary?: string;
    /** The user's Calendar API access role on it (`owner` / `writer`). */
    calendarAccessRole?: GoogleCalendarAccessRole;
    /**
     * Bluz iteration this calendar mirrors. Events of any other iteration are
     * never pushed here, and a pulled-back edit resolves against this one.
     * Links made before this field existed have none and fall back to the
     * current iteration.
     */
    iterationId?: IterationId;
    /** Incremental sync cursor for pulling changes back from Google (nextSyncToken). */
    syncToken?: string;
    connectedAt: number;
};

/** Calendar API access roles (calendarList.accessRole). Bluz needs `writer` or better. */
export type GoogleCalendarAccessRole =
    | "freeBusyReader"
    | "owner"
    | "reader"
    | "writer";

/** One calendar the user may mirror into (from calendarList, `minAccessRole=writer`). */
export type GoogleCalendarOption = {
    id: string;
    summary: string;
    accessRole: GoogleCalendarAccessRole;
    /** The user's primary calendar (their own main one). */
    primary: boolean;
    /** Someone else owns it and shared it with this user. */
    shared: boolean;
};

/** Client-safe view of the linked calendar — no tokens. */
export type GoogleCalendarSelection = {
    id: string;
    summary: string;
    accessRole?: GoogleCalendarAccessRole;
    iterationId?: IterationId;
    /** Label of `iterationId`, resolved server-side for display. */
    iterationLabel?: string;
    /** How many Bluz users (including this one) mirror into this same calendar. */
    linkedUsers: number;
};

/** Client-safe view of the connection state — no tokens. */
export type GoogleCalendarStatus = {
    configured: boolean; // an OAuth client (shipped default or env override) is available
    connected: boolean;
    enabled: boolean;
    /** Public OAuth client id the browser uses for the GIS "Continue with Google" popup. */
    clientId: string;
    /** OAuth scopes the GIS popup must request. */
    scopes: Array<string>;
    /** Present while connected. */
    calendar?: GoogleCalendarSelection;
};

export type ApiGoogleCalendarStatusResponse = GoogleCalendarStatus;
/** Authorization code minted by the browser-side GIS popup. */
export type ApiGoogleCalendarConnectPayload = { code: string };
export type ApiGoogleCalendarSyncResponse = {
    pushed: number;
    /** Google free/busy blocks found. */
    pulled: number;
    /** Bluz events updated from Google-side edits. */
    updated: number;
};

export type ApiGoogleCalendarListResponse = {
    calendars: Array<GoogleCalendarOption>;
    /** Currently linked calendar id. */
    selectedId: string;
};

/**
 * Re-point the link at another calendar. Exactly one of the two: an existing
 * (possibly shared) calendar by id, or a fresh Bluz-created one named after
 * the current iteration.
 */
export type ApiGoogleCalendarSelectPayload =
    | { calendarId: string }
    | { createNew: true };
export type ApiGoogleCalendarSelectResponse = GoogleCalendarSelection;

/**
 * `orphaned`: remove Bluz-tagged Google events whose Bluz event no longer
 * exists, belongs to another iteration than the calendar's, or no longer
 * falls within any linked user's sync scope.
 * `all`: remove every Bluz-tagged event from the calendar.
 * Events created by hand in Google are never touched either way.
 */
export type GoogleCalendarPurgeScope = "all" | "orphaned";
export type ApiGoogleCalendarPurgePayload = { scope: GoogleCalendarPurgeScope };
export type ApiGoogleCalendarPurgeResponse = {
    /** Bluz-tagged Google events inspected. */
    scanned: number;
    removed: number;
    /** Deletes Google rejected (after retries). */
    failed: number;
};
