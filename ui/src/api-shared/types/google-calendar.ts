/**
 * Per-user OAuth link to Google Calendar. Stored server-side only — never sent
 * to the client as-is (see {@link GoogleCalendarStatus}).
 */
export type GoogleCalendarLink = {
    userId: string;
    /** AES-GCM sealed (see api-server/secret-box.ts) — never stored in plaintext. */
    accessToken: string;
    /** AES-GCM sealed (see api-server/secret-box.ts) — never stored in plaintext. */
    refreshToken: string;
    /** Epoch ms when `accessToken` expires. */
    expiryDate: number;
    /** Dedicated calendar Bluz created in the user's Google account to mirror their events. */
    calendarId: string;
    /** Incremental sync cursor for pulling changes back from Google (nextSyncToken). */
    syncToken?: string;
    connectedAt: number;
};

/** Client-safe view of the connection state — no tokens. */
export type GoogleCalendarStatus = {
    configured: boolean; // server has GOOGLE_CLIENT_ID/SECRET set
    connected: boolean;
    enabled: boolean;
};

export type ApiGoogleCalendarStatusResponse = GoogleCalendarStatus;
export type ApiGoogleCalendarConnectResponse = { url: string };
export type ApiGoogleCalendarSyncResponse = { pushed: number; pulled: number };
