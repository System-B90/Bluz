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
    configured: boolean; // an OAuth client (shipped default or env override) is available
    connected: boolean;
    enabled: boolean;
    /** Public OAuth client id the browser uses for the GIS "Continue with Google" popup. */
    clientId: string;
    /** OAuth scopes the GIS popup must request. */
    scopes: Array<string>;
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
