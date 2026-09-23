import { describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt", () => ({ postgresDb: {} }));

import { assignShuffleGroupMembers } from "@/api-server/gantt/db-module-event";

const member = (id: string, shuffles: Array<string> = []) => ({ id, shuffles });

const namesOf = (claimed: Map<string, { id: string }>) =>
    Object.fromEntries([ ...claimed ].map(([ name, m ]) => [ name, m.id ]));

describe("assignShuffleGroupMembers (#699)", () => {
    it("lets every member keep a shuffle it already carries", () => {
        const { claimed, orphans } = assignShuffleGroupMembers(
            [ member("e1", [ "א" ]), member("e2", [ "ב" ]) ],
            [ "א", "ב" ],
            "e1",
        );

        expect(namesOf(claimed)).toEqual({ א: "e1", ב: "e2" });
        expect(orphans).toEqual([]);
    });

    it("hands a free name to the origin before an older sibling", () => {
        // Editing e3 and swapping ב/ג for ד: e2 sorts first by id, but the
        // origin is the event the dialog is showing, so it must survive.
        const { claimed, orphans } = assignShuffleGroupMembers(
            [ member("e1", [ "א" ]), member("e2", [ "ב" ]), member("e3", [ "ג" ]) ],
            [ "א", "ד" ],
            "e3",
        );

        expect(namesOf(claimed)).toEqual({ א: "e1", ד: "e3" });
        expect(orphans.map((m) => m.id)).toEqual([ "e2" ]);
    });

    it("reuses an untagged origin when grouping it for the first time", () => {
        const { claimed, orphans } = assignShuffleGroupMembers(
            [ member("e1") ],
            [ "א", "ב" ],
            "e1",
        );

        expect(namesOf(claimed)).toEqual({ א: "e1" });
        expect(orphans).toEqual([]);
    });

    it("never gives two members the same shuffle", () => {
        const { claimed, orphans } = assignShuffleGroupMembers(
            [ member("e1", [ "א" ]), member("e2", [ "א" ]) ],
            [ "א", "ב" ],
            "e1",
        );

        expect(namesOf(claimed)).toEqual({ א: "e1", ב: "e2" });
        expect(orphans).toEqual([]);
    });
});
