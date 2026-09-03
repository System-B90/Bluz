import { test, expect } from "./fixtures";

/**
 * #465: an empty or truncated request body used to reject with a SyntaxError
 * that fell through to the generic error handler, so a caller mistake came
 * back as an opaque 500. It must be a 400, and the parser's own message
 * (offsets, offending tokens) must not reach the client.
 *
 * Hits the real server: the unit test covers `catchHandler` in isolation, but
 * only this catches a route that parses its body outside the wrapper.
 */

/** Write routes that parse a JSON body, with a method that reaches the parse. */
const BODY_PARSING_ROUTES = [
    { path: "/api/outsiders", method: "post" },
    { path: "/api/outsiders", method: "put" },
    { path: "/api/rooms", method: "post" },
    { path: "/api/course", method: "post" },
    { path: "/api/reservations", method: "put" },
] as const;

const BAD_BODIES = [
    { label: "empty", body: "" },
    { label: "truncated", body: '{"name": ' },
    { label: "not JSON at all", body: "<html>nope</html>" },
] as const;

test.describe("Malformed request bodies (#465)", () => {
    for (const { path, method } of BODY_PARSING_ROUTES) {
        for (const { label, body } of BAD_BODIES) {
            test(`${method.toUpperCase()} ${path} answers 400 for a ${label} body`, async ({
                request,
            }) => {
                const response = await request[method](path, {
                    data: body,
                    headers: { "Content-Type": "application/json" },
                });

                expect(
                    response.status(),
                    `${method} ${path} (${label}) must not 500`,
                ).toBe(400);
            });
        }
    }

    test("does not leak the JSON parser's own message", async ({ request }) => {
        const response = await request.post("/api/outsiders", {
            data: '{"name": "x",,}',
            headers: { "Content-Type": "application/json" },
        });

        expect(response.status()).toBe(400);
        const text = await response.text();
        expect(text).not.toContain("position");
        expect(text).not.toContain("JSON.parse");
    });
});
