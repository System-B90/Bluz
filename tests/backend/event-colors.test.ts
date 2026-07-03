import { describe, it, expect } from "vitest";

import {
    PRAYER_DEFAULT_COLOR,
    resolveEventDefaultColor,
    resolveEventColor,
    resolveColorById,
    updateRecentColorIds,
    excludeSwatchIds,
    MAX_RECENT_COLORS,
} from "@/components/schedule/event-component/event-colors";
import { EventType } from "@/components/schedule/types/event";

const FALLBACK = "#000000";

describe("resolveEventDefaultColor", () => {
    it("uses the prayer default color for prayer events, ignoring subject color", () => {
        const color = resolveEventDefaultColor(
            { type: EventType.PRAYER },
            { color: "#123456" },
            FALLBACK,
        );
        expect(color).toBe(PRAYER_DEFAULT_COLOR);
    });

    it("uses the subject color for non-prayer events", () => {
        const color = resolveEventDefaultColor(
            { type: EventType.EXERCISE },
            { color: "#123456" },
            FALLBACK,
        );
        expect(color).toBe("#123456");
    });

    it("falls back when there is no subject color", () => {
        const color = resolveEventDefaultColor(
            { type: EventType.EXERCISE },
            undefined,
            FALLBACK,
        );
        expect(color).toBe(FALLBACK);
    });
});

describe("resolveEventColor", () => {
    const lookups = {
        getCustomColor: (id: string) =>
            id === "custom-1" ? { hex: "#abcdef" } : undefined,
        getSubject: (id: string) =>
            id === "subject-1" ? { color: "#111111" } : undefined,
    };

    it("prefers a custom color over the default when event.color matches a custom color id", () => {
        const color = resolveEventColor(
            { type: EventType.EXERCISE, color: "custom-1" },
            { color: "#123456" },
            lookups,
            FALLBACK,
        );
        expect(color).toBe("#abcdef");
    });

    it("resolves event.color against Hive subjects when it's not a custom color id", () => {
        const color = resolveEventColor(
            { type: EventType.EXERCISE, color: "subject-1" },
            undefined,
            lookups,
            FALLBACK,
        );
        expect(color).toBe("#111111");
    });

    it("falls back to the default color when event.color matches nothing", () => {
        const color = resolveEventColor(
            { type: EventType.EXERCISE, color: "unknown-id" },
            { color: "#123456" },
            lookups,
            FALLBACK,
        );
        expect(color).toBe("#123456");
    });

    it("falls back to the default color when there is no override", () => {
        const color = resolveEventColor(
            { type: EventType.EXERCISE },
            { color: "#123456" },
            lookups,
            FALLBACK,
        );
        expect(color).toBe("#123456");
    });

    it("still resolves the prayer default when there is no override on a prayer event", () => {
        const color = resolveEventColor(
            { type: EventType.PRAYER },
            { color: "#123456" },
            lookups,
            FALLBACK,
        );
        expect(color).toBe(PRAYER_DEFAULT_COLOR);
    });
});

describe("resolveColorById", () => {
    it("resolves a custom color id to its hex and name", () => {
        const result = resolveColorById("custom-1", {
            getCustomColor: (id) =>
                id === "custom-1" ? { hex: "#abcdef", name: "Custom Purple" } : null,
            getSubject: () => undefined,
        });
        expect(result).toEqual({ hex: "#abcdef", label: "Custom Purple" });
    });

    it("resolves a Hive subject id to its color, preferring displayName over name", () => {
        const result = resolveColorById("subject-1", {
            getCustomColor: () => null,
            getSubject: (id) =>
                id === "subject-1"
                    ? { color: "#111111", displayName: "מתמטיקה", name: "math" }
                    : undefined,
        });
        expect(result).toEqual({ hex: "#111111", label: "מתמטיקה" });
    });

    it("falls back to the subject's name when displayName is missing", () => {
        const result = resolveColorById("subject-1", {
            getCustomColor: () => null,
            getSubject: () => ({ color: "#111111", name: "math" }),
        });
        expect(result).toEqual({ hex: "#111111", label: "math" });
    });

    it("prefers a custom color match over a subject match for the same id", () => {
        const result = resolveColorById("shared-id", {
            getCustomColor: () => ({ hex: "#custom", name: "Custom" }),
            getSubject: () => ({ color: "#subject", name: "Subject" }),
        });
        expect(result).toEqual({ hex: "#custom", label: "Custom" });
    });

    it("returns undefined when the id matches neither a custom color nor a subject", () => {
        const result = resolveColorById("unknown-id", {
            getCustomColor: () => null,
            getSubject: () => undefined,
        });
        expect(result).toBeUndefined();
    });

    it("returns undefined when the matched subject has no color set", () => {
        const result = resolveColorById("subject-1", {
            getCustomColor: () => null,
            getSubject: () => ({ name: "math" }),
        });
        expect(result).toBeUndefined();
    });
});

describe("updateRecentColorIds", () => {
    it("adds a new id to the front of an empty list", () => {
        expect(updateRecentColorIds([], "a")).toEqual([ "a" ]);
    });

    it("moves an existing id to the front instead of duplicating it", () => {
        expect(updateRecentColorIds([ "a", "b", "c" ], "b")).toEqual([ "b", "a", "c" ]);
    });

    it("caps the list at MAX_RECENT_COLORS entries", () => {
        const result = updateRecentColorIds([ "a", "b", "c" ], "d");
        expect(result).toHaveLength(MAX_RECENT_COLORS);
        expect(result).toEqual([ "d", "a", "b" ]);
    });

    it("respects a custom max", () => {
        expect(updateRecentColorIds([ "a", "b" ], "c", 1)).toEqual([ "c" ]);
    });
});

describe("excludeSwatchIds", () => {
    const swatches = [
        { id: "a", hex: "#1" },
        { id: "b", hex: "#2" },
        { id: "c", hex: "#3" },
    ];

    it("filters out swatches whose id is in the exclude set", () => {
        expect(excludeSwatchIds(swatches, [ "b" ])).toEqual([
            { id: "a", hex: "#1" },
            { id: "c", hex: "#3" },
        ]);
    });

    it("is a no-op when there is no overlap", () => {
        expect(excludeSwatchIds(swatches, [ "z" ])).toEqual(swatches);
    });

    it("preserves order of remaining swatches", () => {
        const result = excludeSwatchIds(swatches, [ "a" ]);
        expect(result.map((s) => s.id)).toEqual([ "b", "c" ]);
    });
});
