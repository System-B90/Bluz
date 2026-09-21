import * as fs from "fs";
import * as path from "path";

import { describe, expect, it } from "vitest";

/*
 * ADVERSARIAL SUITE — TOP SECURITY PRIORITY (#656).
 *
 * A whole-surface sweep rather than a per-route test: every API route in the
 * app is enumerated from disk and must prove it is gated. The danger this
 * catches is the one no per-route test can — a *new* route added later that
 * nobody remembered to gate. A student holds a real session, so "is there a
 * session?" is not a gate; only a clearance check is.
 *
 * When you add a route, you either gate it or you add it to PUBLIC_ROUTES with
 * a reason. There is no third option, and "it only reads" is not a reason.
 */

const API_ROOT = path.resolve(__dirname, "../../ui/src/app/api");

/** Calls that perform the clearance check itself. */
const GATE_MARKERS = [
    "requireStaffSession",
    "getStaffSession",
    // The student surface's own gate — the routes using it are asserted
    // individually in `student-view-route.test.ts` / `student-data-leak.test.ts`.
    "requireStudentViewSession",
];

/**
 * Whether a file gates, following its local `@/app/api/...` imports one level
 * deep: most Gantt routes are three lines that hand off to a shared builder
 * (`base-collection`, `base-item`, …), and the builder is where the check
 * lives. One level is enough today and deliberately shallow — a route that
 * hides its gate two hops away is itself the problem.
 */
function gatesClearance(source: string, seen = new Set<string>()): boolean {
    if (GATE_MARKERS.some((marker) => source.includes(marker))) return true;

    for (const match of source.matchAll(/from "@\/app\/api\/([^"]+)"/g)) {
        const helper = path.join(API_ROOT, `${match[1]}.ts`);
        if (seen.has(helper) || !fs.existsSync(helper)) continue;
        seen.add(helper);
        if (gatesClearance(fs.readFileSync(helper, "utf8"), seen)) return true;
    }
    return false;
}

/**
 * Routes that are deliberately reachable without staff clearance, each with
 * the reason it is safe. Adding a line here is a security decision.
 */
const PUBLIC_ROUTES: Record<string, string> = {
    "auth/[...nextauth]/route.ts": "NextAuth's own handler — this is the sign-in.",
    "auth/hive-status/route.ts":
        "Reports whether Hive is reachable. No Bluz data, no per-user data.",
    "cli-auth/redeem/route.ts":
        "Redeems a one-time code the user was handed after signing in; rate-limited and single-use.",
    "health/route.ts": "Liveness probe. Returns no data.",
};

/** Every `route.ts` under `app/api`, as a posix-style relative path. */
function allRouteFiles(dir: string = API_ROOT): Array<string> {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return allRouteFiles(full);
        if (entry.name !== "route.ts") return [];
        return [path.relative(API_ROOT, full).split(path.sep).join("/")];
    });
}

const ROUTES = allRouteFiles();

describe("every API route is gated", () => {
    it("finds the routes at all, so a rename cannot silently empty this suite", () => {
        expect(ROUTES.length).toBeGreaterThan(50);
    });

    for (const route of ROUTES) {
        it(`${route} checks clearance (or is a declared public route)`, () => {
            const source = fs.readFileSync(path.join(API_ROOT, route), "utf8");
            const gated = gatesClearance(source);

            if (PUBLIC_ROUTES[route]) {
                // Declared public: assert the declaration is still needed, so
                // the allowlist cannot rot into a list of gated routes that
                // nobody re-checks.
                expect(
                    gated,
                    `${route} is on PUBLIC_ROUTES but now gates itself — drop the entry`,
                ).toBe(false);
                return;
            }

            expect(
                gated,
                `${route} performs no clearance check. A student session reaches it. ` +
                    "Gate it with requireStaffSession(), or add it to PUBLIC_ROUTES with a reason.",
            ).toBe(true);
        });
    }

    it("declares no public route that no longer exists", () => {
        for (const route of Object.keys(PUBLIC_ROUTES)) {
            expect(ROUTES, `PUBLIC_ROUTES names a missing route: ${route}`).toContain(
                route,
            );
        }
    });
});

describe("the student surface is exactly two routes", () => {
    const studentRoutes = ROUTES.filter((route) =>
        route.startsWith("student-view/"),
    );

    it("has not grown", () => {
        // Growing the student surface is a boundary change: write the
        // adversarial tests and update docs/student-boundary.md first, then
        // this list.
        expect(studentRoutes.sort()).toEqual([
            "student-view/engagement/route.ts",
            "student-view/schedule/route.ts",
        ]);
    });

    it("keeps the schedule route read-only", () => {
        const source = fs.readFileSync(
            path.join(API_ROOT, "student-view/schedule/route.ts"),
            "utf8",
        );

        expect(source).toContain("export const GET");
        for (const verb of ["POST", "PUT", "PATCH", "DELETE"]) {
            expect(
                source,
                `the student schedule route exports ${verb}`,
            ).not.toContain(`export const ${verb}`);
        }
    });

    it("keeps the engagement route write-only", () => {
        const source = fs.readFileSync(
            path.join(API_ROOT, "student-view/engagement/route.ts"),
            "utf8",
        );

        // A readable engagement endpoint would hand a student the tracking
        // numbers kept about them — and, by extension, about everyone.
        expect(source).toContain("export const POST");
        expect(source).not.toContain("export const GET");
    });
});

describe("the student page tree mounts no staff code", () => {
    const STUDENT_COMPONENTS = path.resolve(
        __dirname,
        "../../ui/src/components/student-view",
    );

    /**
     * Imports that would drag the staff data layer into the student bundle.
     * The board must derive everything from the delivered projection.
     */
    const FORBIDDEN_IMPORTS = [
        "components/base/CoursesProvider",
        "components/base/RoomsProvider",
        "components/base/SettingsProvider",
        "components/base/HiveUsersProvider",
        "components/base/HiveSubjectsProvider",
        "components/base/HiveModulesProvider",
        "components/base/HiveLessonsProvider",
        "components/base/OutsidersProvider",
        "components/base/CustomColorsProvider",
        "components/base/CalendarFilterProvider",
        "components/schedule/calendar/calendar-provider",
        "components/schedule/event-dialog",
        "components/settings-dialog",
        "components/gantt",
        "components/header/AppBar",
        "api-client/event",
        "api-client/course",
        "api-client/rooms",
        "api-client/hive",
    ];

    for (const file of fs.readdirSync(STUDENT_COMPONENTS)) {
        it(`${file} imports no staff module`, () => {
            const source = fs.readFileSync(
                path.join(STUDENT_COMPONENTS, file),
                "utf8",
            );

            for (const forbidden of FORBIDDEN_IMPORTS) {
                expect(
                    source,
                    `${file} imports ${forbidden}, which pulls staff data into the student bundle`,
                ).not.toContain(forbidden);
            }
        });
    }

    it("calls only the student endpoints", () => {
        const sources = fs
            .readdirSync(STUDENT_COMPONENTS)
            .map((file) =>
                fs.readFileSync(path.join(STUDENT_COMPONENTS, file), "utf8"),
            )
            .join("\n");

        const endpoints = [...sources.matchAll(/["'`](\/api\/[^"'`]+)["'`]/g)].map(
            (match) => match[1],
        );

        for (const endpoint of endpoints) {
            expect(
                endpoint.startsWith("/api/student-view/") ||
                    endpoint.startsWith("/api/ws-ticket"),
                `the student board names ${endpoint}`,
            ).toBe(true);
        }
    });
});
