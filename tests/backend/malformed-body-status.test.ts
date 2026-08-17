import { describe, expect, it } from "vitest";

import { catchHandler, parseJsonBody, withApi } from "@/api-server/common";

/**
 * An empty or malformed request body is a caller mistake. `request.json()`
 * rejects with a `SyntaxError`, which used to fall through to the generic
 * handler and answer an opaque 500 (#465).
 */

const req = {} as never;

function requestWithBody(body: string) {
    return new Request("https://bluz.test/api/thing", {
        method: "POST",
        body,
    }) as never;
}

describe("malformed JSON body (#465)", () => {
    it("maps a SyntaxError to 400, not 500", async () => {
        const res = catchHandler(req, new SyntaxError("Unexpected end of JSON input"));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toBe("Malformed JSON payload.");
    });

    it("does not leak the parser's own message", async () => {
        const res = catchHandler(req, new SyntaxError("Unexpected token } in JSON at position 7"));
        expect(JSON.stringify(await res.json())).not.toContain("position 7");
    });

    it("answers 400 for an empty body through withApi", async () => {
        const route = withApi(async (request: Request) => {
            await request.json();
            throw new Error("unreachable: empty body must not parse");
        });

        const res = await route(requestWithBody(""));
        expect(res.status).toBe(400);
    });

    it("answers 400 for a truncated body through withApi", async () => {
        const route = withApi(async (request: Request) => {
            await request.json();
            throw new Error("unreachable: truncated body must not parse");
        });

        const res = await route(requestWithBody('{"name": '));
        expect(res.status).toBe(400);
    });

    it("still 500s on a genuine server fault", async () => {
        const route = withApi(async () => {
            throw new TypeError("undefined is not a function");
        });

        expect((await route(requestWithBody("{}"))).status).toBe(500);
    });

    it("keeps parseJsonBody's own 400 path working", () => {
        expect(() => parseJsonBody("{nope")).toThrow("Malformed JSON payload.");
    });
});
