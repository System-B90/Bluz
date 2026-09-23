import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt", () => ({
    postgresDb: {
        transaction: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
        select: vi.fn(),
        selectDistinct: vi.fn(),
        query: { ganttSyllabusesSchema: { findFirst: vi.fn() } },
    },
}));

import { postgresDb } from "@/api-server/gantt";
import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import {
    FOREIGN_KEY_VIOLATION,
    UNIQUE_VIOLATION,
} from "@/api-server/gantt/db-base";
import { ClientApiError } from "@/api-shared/errors";
import {
    GanttCurriculumId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";

const CID = "c1" as GanttCurriculumId;
const SID = "s1" as GanttSyllabusId;

/** Resolves/rejects at any point in a Drizzle-style chain. */
function chain<T>(result: T, reject = false) {
    const settle = () =>
        reject ? Promise.reject(result) : Promise.resolve(result);
    const proxy: Record<string, unknown> = new Proxy(
        {},
        {
            get(_t, prop) {
                if (prop === "then") {
                    return (ok: unknown, err: unknown) =>
                        settle().then(ok as never, err as never);
                }
                if (prop === "catch") {
                    return (err: unknown) => settle().catch(err as never);
                }
                return () => proxy;
            },
        },
    );
    return proxy as never;
}

describe("DbSyllabus.linkItem", () => {
    beforeEach(() => vi.clearAllMocks());

    it("maps a unique violation to 'already linked'", async () => {
        vi.mocked(postgresDb.insert).mockReturnValue(
            chain({ code: UNIQUE_VIOLATION }, true),
        );

        await expect(DbSyllabus.linkItem(CID, SID)).rejects.toThrow(
            ClientApiError,
        );
        await expect(DbSyllabus.linkItem(CID, SID)).rejects.toThrow(
            /כבר משויך/,
        );
    });

    it("maps a foreign-key violation to 'does not exist'", async () => {
        vi.mocked(postgresDb.insert).mockReturnValue(
            chain({ cause: { code: FOREIGN_KEY_VIOLATION } }, true),
        );

        await expect(DbSyllabus.linkItem(CID, SID)).rejects.toThrow(
            /לא קיימים/,
        );
    });

    it("falls back to a generic error for an unmapped failure", async () => {
        vi.mocked(postgresDb.insert).mockReturnValue(
            chain(new Error("boom"), true),
        );

        await expect(DbSyllabus.linkItem(CID, SID)).rejects.toThrow(
            /Failed to add syllabus/,
        );
    });
});

describe("DbSyllabus.unlinkItem", () => {
    beforeEach(() => vi.clearAllMocks());

    it("resolves when the junction row was deleted", async () => {
        vi.mocked(postgresDb.delete).mockReturnValue(
            chain([ { deletedCurriculumId: CID } ]),
        );

        await expect(DbSyllabus.unlinkItem(CID, SID)).resolves.toBeUndefined();
    });

    it("throws when no such link existed", async () => {
        vi.mocked(postgresDb.delete).mockReturnValue(chain([]));

        await expect(DbSyllabus.unlinkItem(CID, SID)).rejects.toThrow(
            /No mapping found/,
        );
    });
});

describe("DbSyllabus.reorderModules", () => {
    beforeEach(() => vi.clearAllMocks());

    it("issues one UPDATE for the whole order (#538 item 9)", async () => {
        vi.mocked(postgresDb.update).mockReturnValue(chain(undefined));

        await DbSyllabus.reorderModules(SID, [
            "m1",
            "m2",
            "m3",
        ] as Array<GanttModuleId>);

        expect(postgresDb.update).toHaveBeenCalledTimes(1);
    });

    it("does nothing for an empty order", async () => {
        await DbSyllabus.reorderModules(SID, []);

        expect(postgresDb.update).not.toHaveBeenCalled();
    });
});

/**
 * Transaction stand-in for the shuffle paths: answers the current-shuffles
 * read, the module/event usage scans, and records the updates.
 */
function shuffleTx(options: {
    current: Array<string>;
    moduleIds?: Array<string>;
    modules?: Array<{ id: string; shuffles: Array<string>; title: string }>;
    events?: Array<{ id: string; shuffles: Array<string>; title: string }>;
}) {
    const updates: Array<Record<string, unknown>> = [];
    let selectCall = 0;
    const tx = {
        query: {
            ganttSyllabusesSchema: {
                findFirst: async () => ({ shuffles: options.current }),
            },
        },
        // First select() is the module-id scan, second is the module scan.
        select: () => {
            selectCall++;
            return chain(
                selectCall === 1
                    ? (options.moduleIds ?? [ "m1" ]).map((moduleId) => ({
                          moduleId,
                      }))
                    : (options.modules ?? []),
            );
        },
        selectDistinct: () => chain(options.events ?? []),
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
    return { tx, updates };
}

describe("DbSyllabus.applyShuffles", () => {
    beforeEach(() => vi.clearAllMocks());

    it("strips a removed shuffle off the modules and events using it (#485)", async () => {
        const { updates } = shuffleTx({
            current: [ "א", "ב" ],
            modules: [ { id: "m1", shuffles: [ "א", "ב" ], title: "מודול" } ],
            events: [ { id: "e1", shuffles: [ "ב" ], title: "אירוע" } ],
        });

        const usages = await DbSyllabus.applyShuffles(SID, [ "א" ]);

        expect(usages.modules).toHaveLength(1);
        expect(usages.events).toHaveLength(1);
        // module, event, then the syllabus itself.
        expect(updates).toHaveLength(3);
        expect(updates[ 0 ].shuffles).toEqual([ "א" ]);
        expect(updates[ 1 ].shuffles).toEqual([]);
        expect(updates[ 2 ].shuffles).toEqual([ "א" ]);
    });

    it("skips the usage scan entirely when nothing was removed", async () => {
        const { updates } = shuffleTx({ current: [ "א" ] });

        const usages = await DbSyllabus.applyShuffles(SID, [ "א", "ב" ]);

        expect(usages).toEqual({ events: [], modules: [] });
        expect(updates).toHaveLength(1);
        expect(updates[ 0 ].shuffles).toEqual([ "א", "ב" ]);
    });

    it("stores trimmed, deduplicated names so look-alike tags cannot coexist", async () => {
        const { updates } = shuffleTx({ current: [] });

        await DbSyllabus.applyShuffles(SID, [ " א ", "א", "ב  ג", "", "ב ג" ]);

        expect(updates.at(-1)?.shuffles).toEqual([ "א", "ב ג" ]);
    });

    it("does the reads inside the same transaction as the writes (#538 item 2)", async () => {
        shuffleTx({ current: [ "א" ] });

        await DbSyllabus.applyShuffles(SID, []);

        expect(postgresDb.transaction).toHaveBeenCalledTimes(1);
    });
});

describe("DbSyllabus.updateItem", () => {
    beforeEach(() => vi.clearAllMocks());

    it("blocks dropping a shuffle that is still in use, naming the holders", async () => {
        shuffleTx({
            current: [ "א", "ב" ],
            modules: [ { id: "m1", shuffles: [ "ב" ], title: "מודול" } ],
        });

        await expect(
            DbSyllabus.updateItem(SID, { shuffles: [ "א" ] }),
        ).rejects.toThrow(/"ב"/);
        await expect(
            DbSyllabus.updateItem(SID, { shuffles: [ "א" ] }),
        ).rejects.toThrow(/מודול/);
    });

    it("does not treat a whitespace-only difference as removing a used shuffle", async () => {
        shuffleTx({
            current: [ "א" ],
            modules: [ { id: "m1", shuffles: [ "א" ], title: "מודול" } ],
        });
        vi.mocked(postgresDb.update).mockReturnValue(chain([ { id: SID } ]));

        const error = await DbSyllabus.updateItem(SID, { shuffles: [ " א " ] })
            .then(() => null, (e: unknown) => e);

        expect(error).not.toBeInstanceOf(ClientApiError);
    });

    it("does not open a transaction when the patch leaves shuffles alone", async () => {
        vi.mocked(postgresDb.update).mockReturnValue(chain([ { id: SID } ]));

        await DbSyllabus.updateItem(SID, { title: "חדש" }).catch(() => undefined);

        expect(postgresDb.transaction).not.toHaveBeenCalled();
    });
});
