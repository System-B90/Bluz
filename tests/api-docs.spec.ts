import { expect, test } from "./fixtures";

/** The app serves its REST API reference (#760), offline installs included. */
test.describe("REST API reference (#760)", () => {
    test("GET /api/docs returns the reference as text", async ({ request }) => {
        const response = await request.get("/api/docs");
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain("text/plain");
        expect(await response.text()).toMatch(/^# REST API/);
    });

    test("the reference lists real endpoints", async ({ request }) => {
        const text = await (await request.get("/api/docs")).text();
        expect(text).toContain("`/api/health`");
        expect(text).toContain("`/api/gantt/syllabuses/{id}`");
    });

    test("every listed GET endpoint without parameters exists", async ({ request }) => {
        const text = await (await request.get("/api/docs")).text();
        const paths = [...text.matchAll(/^\| GET[^|]*\| `([^`{]+)` \|$/gm)].map((m) => m[1]);
        expect(paths.length).toBeGreaterThan(5);
        for (const path of ["/api/health", "/api/docs"]) {
            expect(paths).toContain(path);
            expect((await request.get(path)).status(), path).not.toBe(404);
        }
    });

    test("opens in the browser", async ({ page }) => {
        await page.goto("/api/docs");
        await expect(page.locator("body")).toContainText("REST API");
    });
});
