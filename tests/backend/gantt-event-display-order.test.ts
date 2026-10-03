import { describe, expect, it } from "vitest";

import {
    eventDisplayOrder,
    groupEventBlocks,
} from "@/components/gantt/event-display-order";

/**
 * The timeline listed a module's events in raw junction order while the
 * module dialog gathered each event group together, so the two disagreed
 * (e.g. "(4), (6), (2), (3), (5)" on the timeline, #850).
 */

const events = {
    a: { groupId: null },
    b2: { groupId: "g" },
    c: { groupId: null },
    b3: { groupId: "g" },
    b4: { groupId: "g" },
};

describe("groupEventBlocks (#850)", () => {
    it("places a group where its first member is, members in saved order", () => {
        expect(groupEventBlocks([ "a", "b2", "c", "b3", "b4" ], events)).toEqual([
            { ids: [ "a" ] },
            { groupId: "g", ids: [ "b2", "b3", "b4" ] },
            { ids: [ "c" ] },
        ]);
    });

    it("keeps an id it knows nothing about as a lone event", () => {
        expect(groupEventBlocks([ "ghost", "a" ], events)).toEqual([
            { ids: [ "ghost" ] },
            { ids: [ "a" ] },
        ]);
    });
});

describe("eventDisplayOrder (#850)", () => {
    it("flattens to the order the module dialog shows", () => {
        expect(eventDisplayOrder([ "a", "b2", "c", "b3", "b4" ], events)).toEqual([
            "a", "b2", "b3", "b4", "c",
        ]);
    });

    it("follows a manual reorder of the saved order", () => {
        expect(eventDisplayOrder([ "c", "a", "b2", "b3", "b4" ], events)).toEqual([
            "c", "a", "b2", "b3", "b4",
        ]);
    });

    it("leaves an ungrouped module exactly as saved", () => {
        const plain = { x: { groupId: null }, y: { groupId: null }, z: { groupId: null } };
        expect(eventDisplayOrder([ "z", "x", "y" ], plain)).toEqual([ "z", "x", "y" ]);
    });
});
