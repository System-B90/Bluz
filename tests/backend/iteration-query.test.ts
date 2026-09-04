import { describe, expect, it } from "vitest";

import { iterationEndpoint, withIteration } from "@/api-client/iteration-query";
import { IterationId } from "@/api-shared/types/iteration";

const IT = "2026-a" as IterationId;

describe("withIteration", () => {
    it("appends ?it= when an iteration is given", () => {
        const url = withIteration(new URL("https://x.test/api/events"), IT);

        expect(url.toString()).toBe("https://x.test/api/events?it=2026-a");
    });

    it("leaves the URL untouched for the current (writable) run", () => {
        const url = withIteration(new URL("https://x.test/api/events"));

        expect(url.toString()).toBe("https://x.test/api/events");
    });

    it("keeps existing params and overwrites a stale it=", () => {
        const url = withIteration(
            new URL("https://x.test/api/events?from=1&it=old"),
            IT,
        );

        expect(url.searchParams.get("from")).toBe("1");
        expect(url.searchParams.getAll("it")).toEqual([ "2026-a" ]);
    });

    it("returns the same URL object it was handed", () => {
        const input = new URL("https://x.test/api/events");

        expect(withIteration(input, IT)).toBe(input);
    });
});

describe("iterationEndpoint", () => {
    it("returns the path unchanged with no iteration", () => {
        expect(iterationEndpoint("/api/events")).toBe("/api/events");
    });

    it("uses ? for a bare path and & when a query already exists", () => {
        expect(iterationEndpoint("/api/events", IT)).toBe(
            "/api/events?it=2026-a",
        );
        expect(iterationEndpoint("/api/events?from=1", IT)).toBe(
            "/api/events?from=1&it=2026-a",
        );
    });

    it("percent-encodes the iteration id", () => {
        expect(iterationEndpoint("/api/events", "a b/c" as IterationId)).toBe(
            "/api/events?it=a%20b%2Fc",
        );
    });
});
