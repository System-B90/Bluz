import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt", () => ({
    postgresDb: { transaction: vi.fn() },
}));

import { postgresDb } from "@/api-server/gantt";
import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";

/** Resolves at any point in a Drizzle-style chain. */
function chain<T>(result: T) {
    const proxy: Record<string, unknown> = new Proxy(
        {},
        {
            get(_t, prop) {
                if (prop === "then") {
                    return (ok: unknown, err: unknown) =>
                        Promise.resolve(result).then(ok as never, err as never);
                }
                return () => proxy;
            },
        },
    );
    return proxy as never;
}

const EID = "e1" as GanttEventId;
const MID = "m1" as GanttModuleId;

/** Transaction stand-in: the origin read, the module read, and recorded updates. */
function groupTx(origin: Record<string, unknown>) {
    const updates: Array<Record<string, unknown>> = [];
    let selectCall = 0;
    const tx = {
        select: () => {
            selectCall++;
            return chain(
                selectCall === 1 ? [ origin ] : [ { defaultOrchestratorId: null } ],
            );
        },
        update: () => ({
            set: (values: Record<string, unknown>) => {
                updates.push(values);
                return chain(undefined);
            },
        }),
    };
    vi.mocked(postgresDb.transaction).mockImplementation(
        (async (cb: (t: unknown) => unknown) => await cb(tx)) as never,
    );
    return { updates };
}

beforeEach(() => vi.clearAllMocks());

describe("DbModuleEvent.applyShuffleGroup single shuffle (hotfix)", () => {
    it("assigns an ungrouped event to the one selected shuffle", async () => {
        const { updates } = groupTx({ id: EID, groupId: null, shuffles: [] });

        const { members, removedIds } = await DbModuleEvent.applyShuffleGroup(
            EID,
            MID,
            [ " א " ],
        );

        expect(updates.some((u) => JSON.stringify(u.shuffles) === JSON.stringify([ "א" ]))).toBe(true);
        expect(members[ 0 ].shuffles).toEqual([ "א" ]);
        expect(removedIds).toEqual([]);
    });

    it("regression: an empty selection only ungroups and leaves the tags alone", async () => {
        const { updates } = groupTx({ id: EID, groupId: null, shuffles: [ "ב" ] });

        const { members } = await DbModuleEvent.applyShuffleGroup(EID, MID, []);

        expect(updates.every((u) => u.shuffles === undefined)).toBe(true);
        expect(members[ 0 ].shuffles).toEqual([ "ב" ]);
    });
});
