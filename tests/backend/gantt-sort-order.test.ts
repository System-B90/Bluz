import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Array<Record<string, unknown>> = [];

vi.mock("@/api-server/gantt", () => ({
    postgresDb: {
        transaction: vi.fn(),
        insert: vi.fn(() => ({
            values: (v: Record<string, unknown>) => {
                inserted.push(v);
                return Promise.resolve();
            },
        })),
        query: {
            ganttModulesSchema: { findFirst: vi.fn() },
            ganttEventsSchema: { findFirst: vi.fn() },
        },
    },
}));

import { postgresDb } from "@/api-server/gantt";
import { DbModule } from "@/api-server/gantt/db-module";
import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import {
    M2E_ORDER,
    nextEventSortOrder,
    nextModuleSortOrder,
    S2M_ORDER,
} from "@/api-server/gantt/sort-order";
import {
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";

const dialect = new PgDialect();
const render = (query: Parameters<PgDialect["sqlToQuery"]>[0]) =>
    dialect.sqlToQuery(query);

const SID = "s1" as GanttSyllabusId;
const MID = "m1" as GanttModuleId;
const EID = "e1" as GanttEventId;

describe("nextModuleSortOrder (#761)", () => {
    it("reads max(sort_order) + 1 from s2m", () => {
        const { sql } = render(nextModuleSortOrder(SID));
        expect(sql).toMatch(/max\("s2m"\."sort_order"\) \+ 1/);
        expect(sql).toMatch(/from "s2m"/);
    });

    it("falls back to 0 for an empty syllabus", () => {
        expect(render(nextModuleSortOrder(SID)).sql).toMatch(/coalesce\(.*, 0\)/);
    });

    it("scopes the max to the target syllabus only", () => {
        const { sql, params } = render(nextModuleSortOrder(SID));
        expect(sql).toMatch(/"s2m"\."syllabus_id" = \$1/);
        expect(params).toEqual([SID]);
    });

    it("is a parenthesised scalar subquery usable as a VALUES entry", () => {
        const { sql } = render(nextModuleSortOrder(SID));
        expect(sql.startsWith("(select")).toBe(true);
        expect(sql.endsWith(")")).toBe(true);
    });

    it("binds the id as a parameter, never inlined", () => {
        const evil = "x'; drop table s2m; --" as GanttSyllabusId;
        const { sql, params } = render(nextModuleSortOrder(evil));
        expect(sql).not.toContain("drop table");
        expect(params).toEqual([evil]);
    });
});

describe("nextEventSortOrder (#761)", () => {
    it("reads max(sort_order) + 1 from m2e", () => {
        const { sql } = render(nextEventSortOrder(MID));
        expect(sql).toMatch(/max\("m2e"\."sort_order"\) \+ 1/);
        expect(sql).toMatch(/from "m2e"/);
    });

    it("falls back to 0 for an empty module", () => {
        expect(render(nextEventSortOrder(MID)).sql).toMatch(/coalesce\(.*, 0\)/);
    });

    it("scopes the max to the target module only", () => {
        const { sql, params } = render(nextEventSortOrder(MID));
        expect(sql).toMatch(/"m2e"\."module_id" = \$1/);
        expect(params).toEqual([MID]);
    });

    it("binds the id as a parameter, never inlined", () => {
        const evil = "x'; drop table m2e; --" as GanttModuleId;
        const { sql, params } = render(nextEventSortOrder(evil));
        expect(sql).not.toContain("drop table");
        expect(params).toEqual([evil]);
    });
});

describe("stable read order (#761)", () => {
    it("s2m sorts by sort_order first", () => {
        expect(render(S2M_ORDER[0]).sql).toBe('"s2m"."sort_order" asc');
    });

    it("s2m breaks sort_order ties by module id", () => {
        expect(render(S2M_ORDER[1]).sql).toBe('"s2m"."module_id" asc');
    });

    it("m2e sorts by sort_order first", () => {
        expect(render(M2E_ORDER[0]).sql).toBe('"m2e"."sort_order" asc');
    });

    it("m2e breaks sort_order ties by event id", () => {
        expect(render(M2E_ORDER[1]).sql).toBe('"m2e"."event_id" asc');
    });

    it("has exactly two keys each, so no key silently drops", () => {
        expect(S2M_ORDER).toHaveLength(2);
        expect(M2E_ORDER).toHaveLength(2);
    });
});

describe("linking appends instead of using the column default (#761)", () => {
    beforeEach(() => {
        inserted.length = 0;
        vi.mocked(postgresDb.query.ganttModulesSchema.findFirst).mockResolvedValue(
            { id: MID, m2e: [], s2m: [] } as never,
        );
        vi.mocked(postgresDb.query.ganttEventsSchema.findFirst).mockResolvedValue(
            { id: EID, m2e: [] } as never,
        );
    });

    it("DbModule.linkItem writes an explicit sortOrder", async () => {
        await DbModule.linkItem(SID, MID).catch(() => undefined);
        expect(inserted[0]).toHaveProperty("sortOrder");
    });

    it("DbModule.linkItem's sortOrder is the next-in-syllabus subquery", async () => {
        await DbModule.linkItem(SID, MID).catch(() => undefined);
        expect(render(inserted[0].sortOrder as never)).toEqual(
            render(nextModuleSortOrder(SID)),
        );
    });

    it("DbModule.linkItem never writes a literal 0", async () => {
        await DbModule.linkItem(SID, MID).catch(() => undefined);
        expect(inserted[0].sortOrder).not.toBe(0);
    });

    it("DbModuleEvent.linkItem writes an explicit sortOrder", async () => {
        await DbModuleEvent.linkItem(MID, EID).catch(() => undefined);
        expect(inserted[0]).toHaveProperty("sortOrder");
    });

    it("DbModuleEvent.linkItem's sortOrder is the next-in-module subquery", async () => {
        await DbModuleEvent.linkItem(MID, EID).catch(() => undefined);
        expect(render(inserted[0].sortOrder as never)).toEqual(
            render(nextEventSortOrder(MID)),
        );
    });

    it("DbModuleEvent.linkItem never writes a literal 0", async () => {
        await DbModuleEvent.linkItem(MID, EID).catch(() => undefined);
        expect(inserted[0].sortOrder).not.toBe(0);
    });
});

/** Transaction stand-in recording each insert's table and values. */
function recordingTx() {
    const rows: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const tx = {
        insert: (table: unknown) => ({
            values: (values: Record<string, unknown>) => {
                rows.push({ table, values });
                const done = Promise.resolve([{ id: values.id, ...values }]);
                return Object.assign(done, { returning: () => done });
            },
        }),
    };
    vi.mocked(postgresDb.transaction).mockImplementation(
        ((fn: (t: typeof tx) => unknown) => fn(tx)) as never,
    );
    return rows;
}

describe("createNewItem appends to the parent (#761)", () => {
    it("a new module's s2m row carries the next sortOrder", async () => {
        const rows = recordingTx();
        await DbModule.createNewItem({
            description: "",
            hiveIds: [],
            syllabusId: SID,
            title: "m",
        } as never).catch(() => undefined);
        const junction = rows.find((r) => "moduleId" in r.values && "syllabusId" in r.values);
        expect(junction).toBeDefined();
        expect(render(junction!.values.sortOrder as never)).toEqual(
            render(nextModuleSortOrder(SID)),
        );
    });

    it("a new event's m2e row carries the next sortOrder", async () => {
        const rows = recordingTx();
        await DbModuleEvent.createNewItem({
            minimumDuration: 60,
            moduleId: MID,
            title: "e",
            type: "הרצאה",
        } as never).catch(() => undefined);
        const junction = rows.find((r) => "eventId" in r.values && "moduleId" in r.values);
        expect(junction).toBeDefined();
        expect(render(junction!.values.sortOrder as never)).toEqual(
            render(nextEventSortOrder(MID)),
        );
    });

    it("the new module's own row gets no sortOrder column", async () => {
        const rows = recordingTx();
        await DbModule.createNewItem({
            description: "",
            hiveIds: [],
            syllabusId: SID,
            title: "m",
        } as never).catch(() => undefined);
        expect(rows[0].values).not.toHaveProperty("sortOrder");
    });

    it("the subquery is scoped to the payload's parent, not another", async () => {
        const rows = recordingTx();
        const other = "s_other" as GanttSyllabusId;
        await DbModule.createNewItem({
            description: "",
            hiveIds: [],
            syllabusId: other,
            title: "m",
        } as never).catch(() => undefined);
        const junction = rows.find((r) => "syllabusId" in r.values && "moduleId" in r.values);
        expect(render(junction!.values.sortOrder as never).params).toEqual([other]);
    });
});
