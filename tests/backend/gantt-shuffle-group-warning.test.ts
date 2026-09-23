import { describe, expect, it } from "vitest";

import { describeGroupChange } from "@/components/gantt/event-dialog/EventShuffleGroupField";

const set = (...names: Array<string>) => new Set(names);

/**
 * The shuffle-group field warns about what applying the selection does. It
 * used to say ungrouping deletes the removed shuffles' events - the server
 * keeps them - and said nothing when a regroup really did delete members.
 */
describe("describeGroupChange (#699)", () => {
    it("says ungrouping keeps the events rather than deleting them", () => {
        const change = describeGroupChange(set("א", "ב"), set("א"), 2);

        expect(change?.destructive).toBe(false);
        expect(change?.text).not.toMatch(/יימחק/);
    });

    it("warns when narrowing a group deletes a member", () => {
        const change = describeGroupChange(set("א", "ב", "ג"), set("א", "ב"), 3);

        expect(change).toEqual({
            destructive: true,
            text: "מופע אחד של שאפל שהוסר יימחק.",
        });
    });

    it("does not warn when a dropped member is reused for a new shuffle", () => {
        expect(describeGroupChange(set("א", "ב"), set("א", "ג"), 2)).toBeNull();
    });

    it("counts every member that loses its shuffle", () => {
        const change = describeGroupChange(
            set("א", "ב", "ג", "ד"),
            set("א", "ב"),
            4,
        );

        expect(change?.text).toBe("2 מופעים של שאפלים שהוסרו יימחקו.");
    });

    it("never warns for an event that is not grouped yet", () => {
        expect(describeGroupChange(set("א", "ב", "ג"), set("ד", "ה"), 0)).toBeNull();
        expect(describeGroupChange(set(), set("א"), 0)).toBeNull();
    });
});
