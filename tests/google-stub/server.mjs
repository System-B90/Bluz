// Minimal stand-in for the Google OAuth token endpoint and the slice of the
// Calendar v3 API the Bluz integration calls, so e2e can reach the connected
// state without Google or real credentials (#579). Runs in the test compose
// topology only; the ui container is pointed here by GOOGLE_OAUTH_TOKEN_URL
// and GOOGLE_API_ROOT_URL.
//
// Behaviours mirrored from the real API that the integration depends on:
//  - calendarList entries carry `accessRole`; `minAccessRole` filters them.
//  - events.insert with an id already in the calendar answers 409.
//  - events.list honours `maxResults` + `pageToken`, hides cancelled copies
//    unless `showDeleted`, and hands out a `nextSyncToken` on the last page.
//  - a `syncToken` combined with a filter it did not start with is a 400.
//
// Test-only extras under /__stub/: seed a calendar shared with the user
// (`POST /__stub/shared-calendar`), inspect a calendar's events
// (`GET /__stub/calendars/:id/events`), and reset (`POST /__stub/reset`).
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8080);

/** calendarId -> { summary, accessRole, primary, events: Map<id, event> } */
const calendars = new Map();
let nextCalendar = 1;

function reset() {
    calendars.clear();
    nextCalendar = 1;
    calendars.set("primary", {
        summary: "stub-user@example.com",
        accessRole: "owner",
        primary: true,
        events: new Map(),
    });
}
reset();

function send(res, status, body) {
    const payload = body === undefined ? "" : JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(payload);
}

function readBody(req) {
    return new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => {
            if (!data) return resolve({});
            try {
                resolve(JSON.parse(data));
            } catch {
                resolve(Object.fromEntries(new URLSearchParams(data)));
            }
        });
    });
}

const error = (code, message, reason) => ({
    error: { code, message, errors: reason ? [ { reason } ] : [] },
});
const notFound = error(404, "Not Found", "notFound");

const ROLE_RANK = { freeBusyReader: 0, reader: 1, writer: 2, owner: 3 };

function listEntry(id, cal) {
    return {
        id,
        summary: cal.summary,
        accessRole: cal.accessRole,
        ...(cal.primary ? { primary: true } : {}),
    };
}

function listEvents(calendar, url) {
    const showDeleted = url.searchParams.get("showDeleted") === "true";
    const syncToken = url.searchParams.get("syncToken");
    const filters = url.searchParams.getAll("privateExtendedProperty");
    if (syncToken && filters.length) {
        return [ 400, error(400, "syncToken cannot be combined with privateExtendedProperty", "badRequest") ];
    }
    const maxResults = Math.min(Number(url.searchParams.get("maxResults") ?? 250), 2500);
    const offset = Number(url.searchParams.get("pageToken") ?? 0);

    let items = [ ...calendar.events.values() ];
    if (!showDeleted) items = items.filter((e) => e.status !== "cancelled");
    for (const filter of filters) {
        const [ key, value ] = filter.split("=");
        items = items.filter((e) => e.extendedProperties?.private?.[key] === value);
    }
    const page = items.slice(offset, offset + maxResults);
    const more = offset + maxResults < items.length;
    return [
        200,
        {
            items: page,
            ...(more
                ? { nextPageToken: String(offset + maxResults) }
                : { nextSyncToken: `sync-${Date.now()}` }),
        },
    ];
}

createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const body = await readBody(req);

    if (url.pathname === "/health") return send(res, 200, { ok: true });

    // --- test-only control surface --------------------------------------
    if (parts[0] === "__stub") {
        if (parts[1] === "reset" && req.method === "POST") {
            reset();
            return send(res, 200, { ok: true });
        }
        // A calendar someone else owns and shared with the user (writer).
        if (parts[1] === "shared-calendar" && req.method === "POST") {
            const id = body.id ?? `shared-calendar-${nextCalendar++}`;
            calendars.set(id, {
                summary: body.summary ?? "Shared",
                accessRole: body.accessRole ?? "writer",
                primary: false,
                events: new Map(),
            });
            return send(res, 200, listEntry(id, calendars.get(id)));
        }
        if (parts[1] === "calendars" && parts[2] && parts[3] === "events" && req.method === "GET") {
            const calendar = calendars.get(parts[2]);
            if (!calendar) return send(res, 404, notFound);
            return send(res, 200, { items: [ ...calendar.events.values() ] });
        }
        if (parts[1] === "calendars" && !parts[2] && req.method === "GET") {
            return send(res, 200, {
                items: [ ...calendars ].map(([ id, cal ]) => ({
                    ...listEntry(id, cal),
                    events: cal.events.size,
                })),
            });
        }
        return send(res, 404, notFound);
    }

    if (url.pathname === "/token" && req.method === "POST") {
        if (!body.code && !body.refresh_token) {
            return send(res, 400, { error: "invalid_request" });
        }
        return send(res, 200, {
            access_token: `stub-access-${Date.now()}`,
            refresh_token: "stub-refresh",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/calendar",
        });
    }

    // Everything below lives under /calendar/v3/.
    if (parts[0] !== "calendar" || parts[1] !== "v3") return send(res, 404, notFound);
    const [ , , a, b, c, d ] = parts;

    if (a === "users" && b === "me" && c === "calendarList") {
        if (!d && req.method === "GET") {
            const minRole = ROLE_RANK[url.searchParams.get("minAccessRole") ?? "freeBusyReader"] ?? 0;
            return send(res, 200, {
                items: [ ...calendars ]
                    .filter(([ , cal ]) => ROLE_RANK[cal.accessRole] >= minRole)
                    .map(([ id, cal ]) => listEntry(id, cal)),
            });
        }
        if (d && req.method === "GET") {
            const cal = calendars.get(d);
            return cal ? send(res, 200, listEntry(d, cal)) : send(res, 404, notFound);
        }
    }

    if (a === "calendars" && !b && req.method === "POST") {
        const id = `stub-calendar-${nextCalendar++}`;
        calendars.set(id, {
            summary: body.summary ?? "Bluz",
            accessRole: "owner",
            primary: false,
            events: new Map(),
        });
        return send(res, 200, { id, summary: body.summary });
    }

    if (a === "freeBusy" && req.method === "POST") {
        return send(res, 200, { calendars: { primary: { busy: [] } } });
    }

    const calendar = a === "calendars" ? calendars.get(b) : undefined;
    if (!calendar) return send(res, 404, notFound);

    if (!c && req.method === "PATCH") {
        calendar.summary = body.summary ?? calendar.summary;
        return send(res, 200, { id: b, summary: calendar.summary });
    }

    if (c === "events") {
        if (!d && req.method === "GET") {
            const [ status, payload ] = listEvents(calendar, url);
            return send(res, status, payload);
        }
        if (!d && req.method === "POST") {
            if (body.id && calendar.events.has(body.id)) {
                return send(res, 409, error(409, "The requested identifier already exists.", "duplicate"));
            }
            const id = body.id ?? `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const stored = { ...body, id, status: body.status ?? "confirmed" };
            calendar.events.set(id, stored);
            return send(res, 200, stored);
        }
        if (d && req.method === "PUT") {
            if (!calendar.events.has(d)) return send(res, 404, notFound);
            const stored = { ...body, id: d, status: body.status ?? "confirmed" };
            calendar.events.set(d, stored);
            return send(res, 200, stored);
        }
        if (d && req.method === "DELETE") {
            const existing = calendar.events.get(d);
            if (!existing || existing.status === "cancelled") return send(res, 404, notFound);
            // Google keeps a tombstone under the id; a later insert with the
            // same id is the 409 the integration must recover from.
            calendar.events.set(d, { ...existing, status: "cancelled" });
            return send(res, 204);
        }
    }

    return send(res, 404, notFound);
}).listen(PORT, () => console.log(`google stub listening on ${PORT}`));
