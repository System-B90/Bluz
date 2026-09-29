import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The REST API reference ships with the offline bundle (#760).
 */

// @ts-expect-error -- plain ESM script, no type declarations.
import * as restDocs from "../../scripts/rest-docs.mjs";

const REPO = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(REPO, p), "utf8").replace(/\r\n/g, "\n");
const { API_ROOT, collectEndpoints, exportedMethods, renderRestDocs, toUrlPath } =
    restDocs as {
        API_ROOT: string;
        collectEndpoints: () => Array<{ path: string; methods: Array<string> }>;
        exportedMethods: (source: string) => Array<string>;
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
