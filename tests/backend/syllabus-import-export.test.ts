import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Single-syllabus export and import (#757).
 */

const { requireStaffSession, getItem, transaction, select } = vi.hoisted(() => ({
    requireStaffSession: vi.fn(async () => ({ id: "1" })),
    getItem: vi.fn(),
    transaction: vi.fn(),
    select: vi.fn(),
}));

vi.mock("@/api-server/session-user", () => ({ requireStaffSession }));
vi.mock("@/api-server/gantt", () => ({ postgresDb: { transaction, select } }));
vi.mock("@/api-server/gantt/db-syllabus", () => ({ DbSyllabus: { getItem } }));

import { NextRequest } from "next/server";

import { FOREIGN_KEY_VIOLATION } from "@/api-server/gantt/db-base";
import {
    countSyllabusNodes,
    ImportIdMaps,
    importConstraints,
    importSyllabusTree,
    ImportTx,
    junctionSortOrder,
    MAX_IMPORT_NODES,
} from "@/api-server/gantt/import-tree";
import {
    ganttConstraintsSchema,
    ganttCurriculum2SyllabusesSchema,
    ganttEventsSchema,
    ganttModule2EventsSchema,
    ganttModulesSchema,
    ganttSyllabus2ModulesSchema,
    ganttSyllabusesSchema,
} from "@/api-server/gantt/schema";
import { POST as importRoute } from "@/app/api/gantt/curriculums/[id]/import-syllabus/route";
import { GET as exportRoute } from "@/app/api/gantt/syllabuses/[id]/export/route";
import { ApiSyllabus } from "@/api-shared/types/gantt/api-layer";
import { SYLLABUS_EXPORT_KIND } from "@/api-shared/types/gantt/syllabus-export";

type Row = { table: unknown; values: Record<string, unknown> };

function recordingTx(): { tx: ImportTx; rows: Array<Row> } {
    const rows: Array<Row> = [];
    const tx = {
        insert: (table: unknown) => ({
            values: (values: Record<string, unknown>) => {
                rows.push({ table, values });
                return Promise.resolve();
            },
        }),
    };
    return { tx: tx as unknown as ImportTx, rows };
}

const rowsOf = (rows: Array<Row>, table: unknown) =>
    rows.filter((r) => r.table === table).map((r) => r.values);

function event(id: string, extra: Record<string, unknown> = {}) {
    return {
        id,
        title: `event ${id}`,
        type: "הרצאה",
        minimumDuration: 60,
        hiveLessonId: 42,
        ...extra,
    };
}

function syllabus(): ApiSyllabus {
    return {
        id: "s_old",
        title: "אלגברה",
        hiveIds: [],
        s2m: [
            {
                syllabusId: "s_old",
                moduleId: "m1",
                sortOrder: 1,
                module: {
                    id: "m1",
                    title: "m1",
                    m2e: [
                        { moduleId: "m1", eventId: "e1", sortOrder: 0, event: event("e1") },
                        { moduleId: "m1", eventId: "e2", sortOrder: 1, event: event("e2") },
                    ],
                },
            },
            {
                syllabusId: "s_old",
                moduleId: "m2",
                sortOrder: 0,
                module: {
                    id: "m2",
                    title: "m2",
                    m2e: [{ moduleId: "m2", eventId: "e3", sortOrder: 5, event: event("e3") }],
                },
            },
        ],
    } as unknown as ApiSyllabus;
}

const emptyMaps = (): ImportIdMaps => ({ moduleIdMap: {}, eventIdMap: {} });
const now = new Date("2026-09-29T00:00:00Z");

async function runImport(overrides: Partial<Parameters<typeof importSyllabusTree>[2]> = {}) {
    const { tx, rows } = recordingTx();
    const maps = emptyMaps();
    const id = await importSyllabusTree(tx, syllabus(), {
        curriculumId: "c_new",
        now,
        maps,
        ...overrides,
    });
    return { id, rows, maps };
}

describe("junctionSortOrder", () => {
    it("reads a numeric sortOrder", () => expect(junctionSortOrder({ sortOrder: 3 })).toBe(3));
    it("defaults a missing sortOrder to 0", () => expect(junctionSortOrder({})).toBe(0));
    it("ignores a non-numeric sortOrder", () => expect(junctionSortOrder({ sortOrder: "3" })).toBe(0));
    it("survives null", () => expect(junctionSortOrder(null)).toBe(0));
});

describe("countSyllabusNodes", () => {
    it("counts the syllabus, modules and events", () => expect(countSyllabusNodes(syllabus())).toBe(6));
    it("counts an empty syllabus as one", () =>
        expect(countSyllabusNodes({ s2m: [] } as unknown as ApiSyllabus)).toBe(1));
    it("tolerates a missing s2m", () => expect(countSyllabusNodes({} as ApiSyllabus)).toBe(1));
    it("tolerates undefined", () => expect(countSyllabusNodes(undefined)).toBe(1));
});

describe("importSyllabusTree", () => {
    it("returns a fresh syllabus id", async () => {
        const { id } = await runImport();
        expect(id).toMatch(/^s_/);
        expect(id).not.toBe("s_old");
    });

    it("links the syllabus to the target curriculum", async () => {
        const { id, rows } = await runImport();
        expect(rowsOf(rows, ganttCurriculum2SyllabusesSchema)).toEqual([{ curriculumId: "c_new", syllabusId: id }]);
    });

    it("keeps the title without a suffix", async () => {
        const { rows } = await runImport();
        expect(rowsOf(rows, ganttSyllabusesSchema)[0].title).toBe("אלגברה");
    });

    it("appends the title suffix when given", async () => {
        const { rows } = await runImport({ titleSuffix: " (מיובא)" });
        expect(rowsOf(rows, ganttSyllabusesSchema)[0].title).toBe("אלגברה (מיובא)");
    });

    it("creates every module with a fresh id", async () => {
        const { rows } = await runImport();
        const modules = rowsOf(rows, ganttModulesSchema);
        expect(modules).toHaveLength(2);
        for (const m of modules) expect(m.id).toMatch(/^m_/);
    });

    it("creates every event with a fresh id", async () => {
        const { rows } = await runImport();
        const events = rowsOf(rows, ganttEventsSchema);
        expect(events).toHaveLength(3);
        for (const e of events) expect(String(e.id)).toMatch(/^e_/);
    });

    it("keeps module order", async () => {
        const { rows, maps } = await runImport();
        const s2m = rowsOf(rows, ganttSyllabus2ModulesSchema);
        expect(s2m.find((r) => r.moduleId === maps.moduleIdMap.m1)?.sortOrder).toBe(1);
        expect(s2m.find((r) => r.moduleId === maps.moduleIdMap.m2)?.sortOrder).toBe(0);
    });

    it("keeps event order", async () => {
        const { rows, maps } = await runImport();
        const m2e = rowsOf(rows, ganttModule2EventsSchema);
        expect(m2e.find((r) => r.eventId === maps.eventIdMap.e3)?.sortOrder).toBe(5);
        expect(m2e.find((r) => r.eventId === maps.eventIdMap.e2)?.sortOrder).toBe(1);
    });

    it("links each event to its own new module", async () => {
        const { rows, maps } = await runImport();
        const m2e = rowsOf(rows, ganttModule2EventsSchema);
        expect(m2e.find((r) => r.eventId === maps.eventIdMap.e3)?.moduleId).toBe(maps.moduleIdMap.m2);
        expect(m2e.find((r) => r.eventId === maps.eventIdMap.e1)?.moduleId).toBe(maps.moduleIdMap.m1);
    });

    it("drops the Hive lesson link from copied events", async () => {
        const { rows } = await runImport();
        for (const e of rowsOf(rows, ganttEventsSchema)) expect(e.hiveLessonId).toBeNull();
    });

    it("fills the id maps for constraints", async () => {
        const { maps } = await runImport();
        expect(Object.keys(maps.moduleIdMap).sort()).toEqual(["m1", "m2"]);
        expect(Object.keys(maps.eventIdMap).sort()).toEqual(["e1", "e2", "e3"]);
    });

    it("rejects an event with an invalid enum", async () => {
        const bad = syllabus();
        (bad.s2m[0].module.m2e[0].event as unknown as Record<string, unknown>).type = "not-a-type";
        const { tx } = recordingTx();
        await expect(
            importSyllabusTree(tx, bad, { curriculumId: "c", now, maps: emptyMaps() }),
        ).rejects.toThrow();
    });
});

describe("importConstraints", () => {
    const maps: ImportIdMaps = { moduleIdMap: { m1: "m_new" }, eventIdMap: { e1: "e_new", e2: "e_new2" } };

    it("re-points owner and target at the new ids", async () => {
        const { tx, rows } = recordingTx();
        await importConstraints(tx, [
            { type: "RELATIONAL", ownerEventId: "e1", relation: "after", targetEventId: "e2" },
        ], maps, now);
        const [c] = rowsOf(rows, ganttConstraintsSchema);
        expect(c.ownerEventId).toBe("e_new");
        expect(c.targetEventId).toBe("e_new2");
    });

    it("drops a constraint whose owner was not imported", async () => {
        const { tx, rows } = recordingTx();
        await importConstraints(tx, [{ type: "RELATIONAL", ownerEventId: "elsewhere" }], maps, now);
        expect(rowsOf(rows, ganttConstraintsSchema)).toHaveLength(0);
    });

    it("clears a target outside the import", async () => {
        const { tx, rows } = recordingTx();
        await importConstraints(tx, [
            { type: "RELATIONAL", ownerModuleId: "m1", relation: "after", targetModuleId: "elsewhere" },
        ], maps, now);
        expect(rowsOf(rows, ganttConstraintsSchema)[0].targetModuleId ?? null).toBeNull();
    });

    it("gives each constraint a fresh id", async () => {
        const { tx, rows } = recordingTx();
        await importConstraints(tx, [{ id: "old", type: "RELATIONAL", ownerEventId: "e1" }], maps, now);
        expect(rowsOf(rows, ganttConstraintsSchema)[0].id).not.toBe("old");
    });

    it("ignores a non-array payload", async () => {
        const { tx, rows } = recordingTx();
        await importConstraints(tx, { nope: true }, maps, now);
        expect(rows).toHaveLength(0);
    });
});

function importRequest(body: unknown) {
    return new NextRequest("http://x/api/gantt/curriculums/c_new/import-syllabus", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
    });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const doc = () => ({ version: "1.0", kind: SYLLABUS_EXPORT_KIND, sourceCurriculumId: "c_src", syllabus: syllabus(), constraints: [] });

describe("POST /api/gantt/curriculums/{id}/import-syllabus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        transaction.mockImplementation(async (fn: (tx: ImportTx) => unknown) => fn(recordingTx().tx));
        getItem.mockImplementation(async (id: string) => ({ id, title: "x", s2m: [] }));
    });

    it("imports and returns the new syllabus tree", async () => {
        const response = await importRoute(importRequest(doc()), ctx("c_new"));
        const body = await response.json();
        expect(body.status).toBe(0);
        expect(body.data.id).toMatch(/^s_/);
        expect(getItem).toHaveBeenCalledWith(body.data.id);
    });

    it("requires a staff session", async () => {
        await importRoute(importRequest(doc()), ctx("c_new"));
        expect(requireStaffSession).toHaveBeenCalled();
    });

    it("rejects a whole-curriculum export", async () => {
        const response = await importRoute(importRequest({ version: "1.0", curriculum: { title: "x" } }), ctx("c_new"));
        expect(response.status).toBe(400);
        expect(transaction).not.toHaveBeenCalled();
    });

    it("rejects a file without a syllabus", async () => {
        const response = await importRoute(importRequest({ kind: SYLLABUS_EXPORT_KIND }), ctx("c_new"));
        expect(response.status).toBe(400);
    });

    it("rejects a syllabus without a title", async () => {
        const bad = doc();
        (bad.syllabus as unknown as Record<string, unknown>).title = "";
        const response = await importRoute(importRequest(bad), ctx("c_new"));
        expect(response.status).toBe(400);
    });

    it("rejects an oversized file before touching the database", async () => {
        const big = doc();
        big.constraints = Array.from({ length: MAX_IMPORT_NODES }, () => ({}));
        const response = await importRoute(importRequest(big), ctx("c_new"));
        expect(response.status).toBe(400);
        expect(transaction).not.toHaveBeenCalled();
    });

    it("answers 400 when the curriculum does not exist", async () => {
        transaction.mockRejectedValueOnce({ code: FOREIGN_KEY_VIOLATION });
        const response = await importRoute(importRequest(doc()), ctx("c_missing"));
        expect(response.status).toBe(400);
    });

    it("rejects a non-object body", async () => {
        const response = await importRoute(importRequest([1, 2]), ctx("c_new"));
        expect(response.status).toBe(400);
    });
});

describe("GET /api/gantt/syllabuses/{id}/export", () => {
    const exportRequest = (query = "?curriculumId=c_src") =>
        new NextRequest(`http://x/api/gantt/syllabuses/s_old/export${query}`);

    beforeEach(() => {
        vi.clearAllMocks();
        getItem.mockResolvedValue(syllabus());
        select.mockReturnValue({ from: () => ({ where: async () => [{ id: "k1", type: "RELATIONAL", ownerEventId: "e1" }] }) });
    });

    it("marks the file as a single syllabus", async () => {
        const body = await (await exportRoute(exportRequest(), ctx("s_old"))).json();
        expect(body.data.kind).toBe(SYLLABUS_EXPORT_KIND);
        expect(body.data.version).toBe("1.0");
    });

    it("carries the syllabus tree", async () => {
        const body = await (await exportRoute(exportRequest(), ctx("s_old"))).json();
        expect(body.data.syllabus.id).toBe("s_old");
        expect(body.data.syllabus.s2m).toHaveLength(2);
    });

    it("records the source curriculum", async () => {
        const body = await (await exportRoute(exportRequest(), ctx("s_old"))).json();
        expect(body.data.sourceCurriculumId).toBe("c_src");
    });

    it("omits the source curriculum when not given", async () => {
        const body = await (await exportRoute(exportRequest(""), ctx("s_old"))).json();
        expect(body.data.sourceCurriculumId).toBeUndefined();
    });

    it("includes the constraints its modules and events own", async () => {
        const body = await (await exportRoute(exportRequest(), ctx("s_old"))).json();
        expect(body.data.constraints).toEqual([{ id: "k1", type: "RELATIONAL", ownerEventId: "e1" }]);
    });

    it("skips the constraint query for an empty syllabus", async () => {
        getItem.mockResolvedValue({ id: "s_empty", title: "x", s2m: [] });
        const body = await (await exportRoute(exportRequest(), ctx("s_empty"))).json();
        expect(body.data.constraints).toEqual([]);
        expect(select).not.toHaveBeenCalled();
    });

    it("round-trips into the import route", async () => {
        const exported = (await (await exportRoute(exportRequest(), ctx("s_old"))).json()).data;
        transaction.mockImplementation(async (fn: (tx: ImportTx) => unknown) => fn(recordingTx().tx));
        getItem.mockImplementation(async (id: string) => ({ id, title: "x", s2m: [] }));
        const response = await importRoute(importRequest(exported), ctx("c_new"));
        expect((await response.json()).status).toBe(0);
    });
});
