// Minimal stand-in for the Google OAuth token endpoint and the slice of the
// Calendar v3 API the Bluz integration calls, so e2e can reach the connected
// state without Google or real credentials (#579). Runs in the test compose
// topology only; the ui container is pointed here by GOOGLE_OAUTH_TOKEN_URL
// and GOOGLE_API_ROOT_URL.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8080);

const calendars = new Map(); // calendarId -> { summary, events: Map }
let nextCalendar = 1;

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

const notFound = { error: { code: 404, message: "Not Found" } };

createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const body = await readBody(req);

    if (url.pathname === "/health") return send(res, 200, { ok: true });

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

    if (a === "users" && b === "me" && c === "calendarList" && req.method === "GET") {
        return send(res, 200, {
            items: [ ...calendars ].map(([ id, cal ]) => ({ id, summary: cal.summary })),
        });
    }

    if (a === "calendars" && !b && req.method === "POST") {
        const id = `stub-calendar-${nextCalendar++}`;
        calendars.set(id, { summary: body.summary ?? "Bluz", events: new Map() });
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
            return send(res, 200, {
                items: [ ...calendar.events.values() ],
                nextSyncToken: `sync-${Date.now()}`,
            });
        }
        if (!d && req.method === "POST") {
            calendar.events.set(body.id, body);
            return send(res, 200, body);
        }
        if (d && req.method === "PUT") {
            if (!calendar.events.has(d)) return send(res, 404, notFound);
            calendar.events.set(d, { ...body, id: d });
            return send(res, 200, { ...body, id: d });
        }
        if (d && req.method === "DELETE") {
            if (!calendar.events.delete(d)) return send(res, 404, notFound);
            return send(res, 204);
        }
    }

    return send(res, 404, notFound);
}).listen(PORT, () => console.log(`google stub listening on ${PORT}`));
