import { describe, expect, it } from "vitest";

import { orchestratedFirst } from "@/components/gantt/curriculum-view/tabs/syllabuses-tab/orchestrated-first";

/** Syllabuses tab: the ones the logged-in instructor orchestrates come first (#748). */

const ME = 7;
const state = {
    syllabuses: {
        a: { modules: [ "ma" ] },
        b: { modules: [ "mb" ] },
        c: { modules: [ "mc" ] },
        d: { modules: [ "md" ] },
    },
    modules: {
        ma: { events: [ "ea" ], defaultOrchestratorId: null },
        mb: { events: [ "eb" ], defaultOrchestratorId: null },
        mc: { events: [], defaultOrchestratorId: ME },
        md: { events: [ "ed" ], defaultOrchestratorId: 99 },
    },
    events: {
        ea: { orchestratorId: 99 },
        eb: { orchestratorId: ME },
        ed: { orchestratorId: null },
    },
};

describe("orchestratedFirst", () => {
    it("moves syllabuses I orchestrate (by event or module default) first, stably", () => {
        expect(orchestratedFirst([ "a", "b", "c", "d" ], ME, state)).toEqual([ "b", "c", "a", "d" ]);
    });

    it("keeps the order for users who orchestrate nothing", () => {
        const ids = [ "a", "b", "c", "d" ];
        expect(orchestratedFirst(ids, 12345, state)).toBe(ids);
    });

    it("keeps the order when there is no logged-in user id", () => {
        const ids = [ "d", "c" ];
        expect(orchestratedFirst(ids, null, state)).toBe(ids);
    });
});
