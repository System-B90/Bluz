import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

/**
 * The REST API reference ships with the offline bundle and the app (#760).
 */

const { requireStaffSession } = vi.hoisted(() => ({
    requireStaffSession: vi.fn(async () => ({ id: "1" })),
}));
vi.mock("@/api-server/session-user", () => ({ requireStaffSession }));

// @ts-expect-error -- plain ESM script, no type declarations.
import * as restDocs from "../../scripts/rest-docs.mjs";
import { GET } from "@/app/api/docs/route";
import { REST_API_MARKDOWN } from "@/app/api/docs/rest-api.generated";

const REPO = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(REPO, p), "utf8").replace(/\r\n/g, "\n");
const { API_ROOT, collectEndpoints, exportedMethods, renderAppModule, renderRestDocs, toUrlPath } =
    restDocs as {
        API_ROOT: string;
        collectEndpoints: () => Array<{ path: string; methods: Array<string> }>;
        exportedMethods: (source: string) => Array<string>;
        renderAppModule: (markdown?: string) => string;
        renderRestDocs: () => string;
        toUrlPath: (file: string) => string;
    };

function routeFiles(dir: string): Array<string> {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? routeFiles(join(dir, e.name)) : e.name === "route.ts" ? [join(dir, e.name)] : [],
    );
}

describe("toUrlPath", () => {
    it("maps a plain route", () => {
        expect(toUrlPath(join(API_ROOT, "health", "route.ts"))).toBe("/api/health");
    });

    it("maps a dynamic segment to {name}", () => {
        expect(toUrlPath(join(API_ROOT, "gantt", "modules", "[id]", "route.ts"))).toBe("/api/gantt/modules/{id}");
    });

    it("maps a catch-all segment", () => {
        expect(toUrlPath(join(API_ROOT, "auth", "[...nextauth]", "route.ts"))).toBe("/api/auth/{...nextauth}");
    });

    it("drops route groups", () => {
        expect(toUrlPath(join(API_ROOT, "(internal)", "x", "route.ts"))).toBe("/api/x");
    });
});

describe("exportedMethods", () => {
    it("finds `export const GET = ...`", () => {
        expect(exportedMethods("export const GET = withApi(async () => {});")).toEqual(["GET"]);
    });

    it("finds `export async function POST`", () => {
        expect(exportedMethods("export async function POST() {}")).toEqual(["POST"]);
    });

    it("finds a typed export", () => {
        expect(exportedMethods("export const PUT: ServerApiRoomCreate = withApi(x);")).toEqual(["PUT"]);
    });

    it("finds a named export list", () => {
        expect(exportedMethods("export { DELETE, GET, PATCH };")).toEqual(["GET", "PATCH", "DELETE"]);
    });

    it("finds aliased exports", () => {
        expect(exportedMethods("export { customHandler as GET, customHandler as POST };")).toEqual(["GET", "POST"]);
    });

    it("ignores non-method exports", () => {
        expect(exportedMethods('export const dynamic = "force-dynamic";')).toEqual([]);
    });

    it("returns methods in canonical order", () => {
        expect(exportedMethods("export const DELETE = a; export const GET = b;")).toEqual(["GET", "DELETE"]);
    });
});

describe("generated reference", () => {
    it("docs/rest-api.md is up to date (run `npm run docs:rest`)", () => {
        expect(read("docs/rest-api.md")).toBe(renderRestDocs());
    });

    it("the app's copy is up to date (run `npm run docs:rest`)", () => {
        expect(read("ui/src/app/api/docs/rest-api.generated.ts")).toBe(renderAppModule());
    });

    it("the app serves the same text as the bundle", () => {
        expect(REST_API_MARKDOWN).toBe(read("docs/rest-api.md"));
    });

    it("lists every route file that exports a method", () => {
        const listed = new Set(collectEndpoints().map((e) => e.path));
        for (const file of routeFiles(API_ROOT)) {
            if (exportedMethods(readFileSync(file, "utf8")).length === 0) continue;
            expect(listed.has(toUrlPath(file)), toUrlPath(file)).toBe(true);
        }
    });

    it("lists the gantt reorder endpoints", () => {
        const md = renderRestDocs();
        expect(md).toContain("`/api/gantt/syllabuses/{id}/reorder-modules`");
        expect(md).toContain("`/api/gantt/modules/{id}/reorder-events`");
    });

    it("lists itself", () => {
        expect(renderRestDocs()).toContain("| GET | `/api/docs` |");
    });

    it("is sorted by path", () => {
        const paths = collectEndpoints().map((e) => e.path);
        expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
    });

    it("has no duplicate paths", () => {
        const paths = collectEndpoints().map((e) => e.path);
        expect(new Set(paths).size).toBe(paths.length);
    });
});

describe("offline bundle", () => {
    const app = JSON.parse(read("deploy/app.json"));

    it("ships the reference as API.md", () => {
        expect(app.bundle.files["API.md"]).toBe("docs/rest-api.md");
    });

    it("tells the installer where to find it", () => {
        expect(app.post_install.join("\n")).toContain("API.md");
    });

    it("keeps shipping the install docs", () => {
        expect(app.bundle.files["INSTALL.md"]).toBeDefined();
        expect(app.bundle.files["TROUBLESHOOTING.md"]).toBeDefined();
    });
});

describe("discoverability", () => {
    it("README links the reference", () => {
        expect(read("README.md")).toContain("docs/rest-api.md");
    });

    it("the docs site nav includes it", () => {
        expect(read("mkdocs.yml")).toContain("rest-api.md");
    });

    it("npm run docs:rest regenerates it", () => {
        expect(JSON.parse(read("package.json")).scripts["docs:rest"]).toContain("scripts/rest-docs.mjs");
    });
});

describe("GET /api/docs", () => {
    it("returns the reference as readable text", async () => {
        const response = await GET(new Request("http://x/api/docs"));
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toContain("text/plain");
        expect(await response.text()).toBe(REST_API_MARKDOWN);
    });

    it("requires a staff session", async () => {
        requireStaffSession.mockClear();
        await GET(new Request("http://x/api/docs"));
        expect(requireStaffSession).toHaveBeenCalledTimes(1);
    });

    it("does not serve it when the session check fails", async () => {
        requireStaffSession.mockRejectedValueOnce(new Error("no session"));
        const response = await GET(new Request("http://x/api/docs"));
        expect(response.status).not.toBe(200);
    });
});
