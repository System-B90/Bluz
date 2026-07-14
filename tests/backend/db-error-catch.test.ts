import { describe, expect, it } from "vitest";

import { catchHandler, isDatabaseError } from "@/api-server/common";
import { ClientApiError } from "@/api-shared/errors";

// Shape of a postgres.js PostgresError (e.g. a NOT NULL violation).
function fakePgError() {
    return Object.assign(new Error('null value in column "title" violates not-null constraint'), {
        name: "PostgresError",
        code: "23502",
        severity: "ERROR",
        table: "gantt_curriculums",
        column: "title",
    });
}

describe("isDatabaseError (#162)", () => {
    it("detects a postgres.js error by name", () => {
        expect(isDatabaseError(fakePgError())).toBe(true);
    });

    it("detects a SQLSTATE-coded error with severity", () => {
        expect(
            isDatabaseError({ code: "23505", severity: "ERROR" }),
        ).toBe(true);
    });

    it("does not flag plain errors or client errors", () => {
        expect(isDatabaseError(new Error("nope"))).toBe(false);
        expect(isDatabaseError(new ClientApiError("bad input"))).toBe(false);
        expect(isDatabaseError(null)).toBe(false);
        expect(isDatabaseError("string")).toBe(false);
    });
});

describe("catchHandler DB error masking (#162)", () => {
    const req = {} as never;

    it("returns an opaque 500 without leaking DB internals", async () => {
        const res = catchHandler(req, fakePgError());
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error.message).toBe("Internal Database Error");
        // No table/column/constraint/SQL text leaks.
        expect(JSON.stringify(body)).not.toContain("title");
        expect(JSON.stringify(body)).not.toContain("gantt_curriculums");
        expect(JSON.stringify(body)).not.toContain("not-null");
    });

    it("still maps ClientApiError to a 400 with its message", async () => {
        const res = catchHandler(req, new ClientApiError("Payload must be a JSON object."));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toBe("Payload must be a JSON object.");
    });
});
