import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";

import { buildGanttExcelWorkbook, BOOL_ICON } from "@/app/api/gantt/curriculums/[id]/export/excel/workbook";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";

// ── Shared fixture ───────────────────────────────────────────────────────────
// One syllabus, two modules:
//   - "Module Full": every event allocated -> placeholder row omitted.
//   - "Module Partial": one of two events allocated -> placeholder row kept.
// Two weeks, week 1 has a comment, week 2 has none (falls back to "ללא הערה").
// Week 1 / day 1 (Sunday) has two mappings (merge check); day 2 (Monday) has none (empty-day fallback).

function buildFixture() {
    const curriculum = {
        id: "c1",
        title: "Curriculum Test",
        description: "Test description",
        startDate: "2026-06-18", // Thursday
        c2s: [
            {
                syllabus: {
                    id: "s1",
                    title: "Syllabus 1",
                    s2m: [
                        {
                            module: {
                                id: "modFull",
                                title: "Module Full",
                                m2e: [
                                    {
                                        event: {
                                            id: "e1",
                                            title: "Event 1",
                                            type: "הרצאה",
                                            minimumDuration: 60,
                                            allocatedDuration: 60,
                                            orchestratorId: 1,
                                            roomRequirement: "בחוץ",
                                            recurrence: "weekly",
                                            isCritical: true,
                                            isPaWindow: false,
                                            systemRequirements: ["מקרן"],
                                            comment: "הערה 1",
                                            cEC: [{ curriculumId: "c1", eventId: "e1", allocatedDuration: 90 }],
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            module: {
                                id: "modPartial",
                                title: "Module Partial",
                                m2e: [
                                    {
                                        event: {
                                            id: "e2",
                                            title: "Event 2",
                                            type: "תרגול",
                                            minimumDuration: 30,
                                            allocatedDuration: 30,
                                            orchestratorId: null,
                                            roomRequirement: null,
                                            recurrence: "none",
                                            isCritical: false,
                                            isPaWindow: true,
                                            systemRequirements: [],
                                            comment: "",
                                            cEC: [],
                                        },
                                    },
                                    {
                                        event: {
                                            id: "e3",
                                            title: "Event 3",
                                            type: "אחר",
                                            minimumDuration: 45,
                                            allocatedDuration: 45,
                                            orchestratorId: null,
                                            roomRequirement: null,
                                            recurrence: "daily",
                                            isCritical: false,
                                            isPaWindow: false,
                                            systemRequirements: [],
                                            comment: "",
                                            cEC: [],
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        ],
        c2w: [
            {
                week: {
                    id: "w1",
                    number: 1,
                    comment: "שבוע היכרות",
                    w2d: [
                        { day: { id: "d1", dayIndex: 0, totalWorkingMinutes: 120 } }, // Sunday
                        { day: { id: "d2", dayIndex: 1, totalWorkingMinutes: 60 } },  // Monday, no mappings
                    ],
                },
            },
            {
                week: {
                    id: "w2",
                    number: 2,
                    comment: "",
                    w2d: [{ day: { id: "d3", dayIndex: 0, totalWorkingMinutes: 60 } }],
                },
            },
        ],
    } as unknown as ApiCurriculum;

    const mappings = [
        // modFull: placeholder + its one event, both on day d1 -> placeholder should be omitted.
        { dayId: "d1", moduleId: "modFull", eventId: null, sortOrder: 0 },
        { dayId: "d1", moduleId: "modFull", eventId: "e1", sortOrder: 1 },
        // modPartial: placeholder + only e2 allocated (e3 stays unallocated) -> placeholder kept.
        { dayId: "d1", moduleId: "modPartial", eventId: null, sortOrder: 2 },
        { dayId: "d1", moduleId: "modPartial", eventId: "e2", sortOrder: 3 },
    ];

    return { curriculum, mappings };
}

function getMerges(sheet: ExcelJS.Worksheet): Array<string> {
    return Object.keys(
        (sheet as unknown as { _merges: Record<string, unknown> })._merges,
    );
}

describe("buildGanttExcelWorkbook", () => {
    it("produces the three expected sheets in order", async () => {
        const { curriculum, mappings } = buildFixture();
        const wb = await buildGanttExcelWorkbook(curriculum, mappings);
        expect(wb.worksheets.map((s) => s.name)).toEqual(["סקירה", "לוח זמנים", "פירוט סילבוסים"]);
    });

    describe("סקירה (Overview) sheet", () => {
        it("reports title, description, dates, week count, total hours, and syllabus list", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const overview = wb.getWorksheet("סקירה")!;

            const rows: Record<string, string> = {};
            overview.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // merged title row
                rows[String(row.getCell(1).value)] = String(row.getCell(2).value);
            });

            expect(rows["שם הגאנט"]).toBe("Curriculum Test");
            expect(rows["תיאור"]).toBe("Test description");
            expect(rows["תאריך התחלה"]).toBe("18/06/2026");
            // Week 1 max offset: Monday (wIdx0*7+1)=1 -> day1(Fri) 2026-06-19; week2 day0 offset=7 -> 2026-06-25
            expect(rows["תאריך סיום"]).toBe("25/06/2026");
            expect(rows["מספר שבועות"]).toBe("2");
            // 120 + 60 + 60 minutes = 240min = 4h
            expect(rows["סך שעות עבודה"]).toBe("4");
            expect(rows["סילבוסים כלולים"]).toBe("Syllabus 1");
        });

        it("falls back to placeholders when start date or description are missing", async () => {
            const { curriculum, mappings } = buildFixture();
            curriculum.startDate = null;
            curriculum.description = "";
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const overview = wb.getWorksheet("סקירה")!;

            const rows: Record<string, string> = {};
            overview.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                rows[String(row.getCell(1).value)] = String(row.getCell(2).value);
            });

            expect(rows["תיאור"]).toBe("-");
            expect(rows["תאריך התחלה"]).toBe("לא נקבע");
            expect(rows["תאריך סיום"]).toBe("לא נקבע");
        });
    });

    describe("לוח זמנים (Timeline) sheet", () => {
        it("uses the week comment as the week name, falling back when blank", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const timeline = wb.getWorksheet("לוח זמנים")!;

            const weekNames = new Set<string>();
            timeline.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                weekNames.add(String(row.getCell(2).value ?? ""));
            });

            expect(weekNames.has("שבוע היכרות")).toBe(true);
            expect(weekNames.has("ללא הערה")).toBe(true);
        });

        it("omits the module placeholder row once all its events are allocated, keeps it otherwise", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const timeline = wb.getWorksheet("לוח זמנים")!;

            const rows: Array<Array<unknown>> = [];
            timeline.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                rows.push(row.values as Array<unknown>);
            });

            const MODULE_COL = 6;
            const EVENT_COL = 7;

            const modFullRows = rows.filter((r) => r[MODULE_COL] === "Module Full");
            expect(modFullRows).toHaveLength(1);
            expect(modFullRows[0][EVENT_COL]).toBe("Event 1");

            const modPartialRows = rows.filter((r) => r[MODULE_COL] === "Module Partial");
            expect(modPartialRows).toHaveLength(2);
            expect(modPartialRows.some((r) => r[EVENT_COL] === "-")).toBe(true);
            expect(modPartialRows.some((r) => r[EVENT_COL] === "Event 2")).toBe(true);
        });

        it("shows a single placeholder row for a day with no mappings", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const timeline = wb.getWorksheet("לוח זמנים")!;

            const rows: Array<Array<unknown>> = [];
            timeline.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                rows.push(row.values as Array<unknown>);
            });

            // Monday (d2, dayIndex 1) has no mappings -> "-" placeholder across syllabus/module/event.
            const mondayRows = rows.filter((r) => r[3] === "שני");
            expect(mondayRows).toHaveLength(1);
            expect(mondayRows[0][5]).toBe("-"); // syllabusTitle
            expect(mondayRows[0][6]).toBe("-"); // moduleTitle
            expect(mondayRows[0][7]).toBe("-"); // eventTitle
        });

        it("merges the week-number and week-name columns across every row of the week", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const timeline = wb.getWorksheet("לוח זמנים")!;
            const merges = getMerges(timeline);

            expect(merges.some((r) => r.startsWith("A"))).toBe(true);
            expect(merges.some((r) => r.startsWith("B"))).toBe(true);
        });

        it("merges the day-name and date columns across every mapping row for a day, but not single-row days", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const timeline = wb.getWorksheet("לוח זמנים")!;
            const merges = getMerges(timeline);

            // Day d1 has 2 rows (modFull's event + modPartial's placeholder + modPartial's event = 3 actually)
            expect(merges.some((r) => r.startsWith("C"))).toBe(true);
            expect(merges.some((r) => r.startsWith("D"))).toBe(true);
        });

        it("merges consecutive identical סילבוס/מודול cells, but not distinct or non-adjacent values", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const timeline = wb.getWorksheet("לוח זמנים")!;
            const merges = getMerges(timeline);

            // Day d1 rows (in sortOrder): modFull/e1, modPartial/placeholder, modPartial/e2 -
            // all three share syllabusTitle "Syllabus 1" -> a single E-column merge spanning them.
            const eMerges = merges.filter((r) => r.startsWith("E"));
            expect(eMerges).toHaveLength(1);
            expect(eMerges[0]).toBe("E3"); // top-left anchor of the E3:E5 merge

            // moduleTitle only repeats for the two modPartial rows -> a single F-column merge,
            // Module Full's single row gets no merge of its own.
            const fMerges = merges.filter((r) => r.startsWith("F"));
            expect(fMerges).toHaveLength(1);
            expect(fMerges[0]).toBe("F4"); // top-left anchor of the F4:F5 merge

            // The two separate empty-day "-" rows (Monday of week 1, Sunday of week 2) are not
            // adjacent (a week-header row sits between them), so they must not be merged together.
            expect(merges.some((r) => r.startsWith("E6"))).toBe(false);
            expect(merges.some((r) => r.startsWith("E8"))).toBe(false);
        });

        it("computes and formats the week summary total hours", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const timeline = wb.getWorksheet("לוח זמנים")!;

            // Week 1 header row is the first data row (row 2).
            const weekHeaderRow = timeline.getRow(2);
            // e1 allocated=90min=1.5h, e2 allocated=30min=0.5h -> total 2h
            expect(weekHeaderRow.getCell(8).value).toBe(2);
        });
    });

    describe("פירוט סילבוסים (Detail) sheet", () => {
        it("lists every field for each event row", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const detail = wb.getWorksheet("פירוט סילבוסים")!;

            const rows: Array<Array<unknown>> = [];
            detail.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const cells: Array<unknown> = [];
                row.eachCell({ includeEmpty: true }, (cell) => cells.push(cell.value));
                rows.push(cells);
            });

            const eventRow = rows.find((r) => r[2] === "Event 1")!;
            expect(eventRow[3]).toBe("הרצאה"); // type
            expect(eventRow[4]).toBe(BOOL_ICON.yes); // isAllocated (e1 is mapped)
            expect(eventRow[5]).toBe(1); // minHours (60min)
            expect(eventRow[6]).toBe(1.5); // requiredHours (allocated 90min via cEC)
            // No name map passed, so the raw id is the fallback (#466).
            expect(eventRow[7]).toBe("1");
            expect(eventRow[8]).toBe("בחוץ"); // room
            expect(eventRow[9]).toBe("שבועי"); // recurrence
            expect(eventRow[10]).toBe(BOOL_ICON.yes); // isCritical
            expect(eventRow[11]).toBe(BOOL_ICON.no); // isPaWindow
            expect(eventRow[12]).toBe("מקרן"); // systemReqs
            expect(eventRow[13]).toBe("הערה 1"); // comment

            const unallocatedRow = rows.find((r) => r[2] === "Event 3")!;
            expect(unallocatedRow[4]).toBe(BOOL_ICON.no); // e3 was never mapped
            expect(unallocatedRow[8]).toBe("-"); // no room requirement
            expect(unallocatedRow[9]).toBe("יומי");
        });

        it("shows the orchestrator's Hive name, not the id (#466)", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(
                curriculum,
                mappings,
                new Map([[1, "רס\"ן ישראלה ישראלי"]]),
            );
            const detail = wb.getWorksheet("פירוט סילבוסים")!;

            const rows: Array<Array<unknown>> = [];
            detail.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const cells: Array<unknown> = [];
                row.eachCell({ includeEmpty: true }, (cell) => cells.push(cell.value));
                rows.push(cells);
            });

            expect(rows.find((r) => r[2] === "Event 1")![7]).toBe("רס\"ן ישראלה ישראלי");
            // No orchestrator at all still reads as a dash, not "null".
            expect(rows.find((r) => r[2] === "Event 2")![7]).toBe("-");
        });

        it("falls back to the id when Hive does not know the user (#466)", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(
                curriculum,
                mappings,
                new Map([[999, "Someone Else"]]),
            );
            const detail = wb.getWorksheet("פירוט סילבוסים")!;

            const rows: Array<Array<unknown>> = [];
            detail.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const cells: Array<unknown> = [];
                row.eachCell({ includeEmpty: true }, (cell) => cells.push(cell.value));
                rows.push(cells);
            });

            expect(rows.find((r) => r[2] === "Event 1")![7]).toBe("1");
        });

        it("uses the renamed מערך/מופע headers instead of מודול/אירוע", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);

            const timelineHeaders = (wb.getWorksheet("לוח זמנים")!.getRow(1).values as Array<unknown>).map(
                (v) => String(v ?? ""),
            );
            expect(timelineHeaders).toContain("מערך");
            expect(timelineHeaders).toContain("מופע");
            expect(timelineHeaders).not.toContain("מודול");
            expect(timelineHeaders).not.toContain("אירוע");

            const detailHeaders = (wb.getWorksheet("פירוט סילבוסים")!.getRow(1).values as Array<unknown>).map(
                (v) => String(v ?? ""),
            );
            expect(detailHeaders).toContain("מערך");
            expect(detailHeaders).toContain("מופע");
            expect(detailHeaders).not.toContain("מודול");
            expect(detailHeaders).not.toContain("אירוע");
        });

        it("computes module and syllabus summary totals from required hours", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const detail = wb.getWorksheet("פירוט סילבוסים")!;

            const rows: Array<Array<unknown>> = [];
            detail.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const cells: Array<unknown> = [];
                row.eachCell({ includeEmpty: true }, (cell) => cells.push(cell.value));
                rows.push(cells);
            });

            // Module Full: only e1 = 1.5h.
            const modFullRow = rows.find((r) => r[1] === "Module Full")!;
            expect(modFullRow[6]).toBe(1.5);

            // Module Partial: e2 (0.5h) + e3 (0.75h) = 1.25h.
            const modPartialRow = rows.find((r) => r[1] === "Module Partial")!;
            expect(modPartialRow[6]).toBe(1.25);

            // Syllabus total: 1.5 + 1.25 = 2.75h.
            const syllabusRow = rows.find((r) => r[0] === "Syllabus 1")!;
            expect(syllabusRow[6]).toBe(2.75);
        });

        it("merges the syllabus column across the syllabus row and all its module/event rows", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const detail = wb.getWorksheet("פירוט סילבוסים")!;
            const merges = getMerges(detail);

            expect(merges.some((r) => r.startsWith("A"))).toBe(true);
        });

        it("merges the module column across the module row and its own event rows only", async () => {
            const { curriculum, mappings } = buildFixture();
            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const detail = wb.getWorksheet("פירוט סילבוסים")!;
            const merges = getMerges(detail);

            // Module Full (1 event) and Module Partial (2 events) each get their own B-column merge.
            expect(merges.filter((r) => r.startsWith("B"))).toHaveLength(2);
        });
    });

    describe("edge cases", () => {
        it("handles a curriculum with no syllabuses, weeks, or mappings", async () => {
            const curriculum = {
                id: "empty",
                title: "Empty Curriculum",
                description: null,
                startDate: null,
                c2s: [],
                c2w: [],
            } as unknown as ApiCurriculum;

            const wb = await buildGanttExcelWorkbook(curriculum, []);
            expect(wb.worksheets.map((s) => s.name)).toEqual(["סקירה", "לוח זמנים", "פירוט סילבוסים"]);

            const timeline = wb.getWorksheet("לוח זמנים")!;
            expect(timeline.rowCount).toBe(1); // header row only

            const detail = wb.getWorksheet("פירוט סילבוסים")!;
            expect(detail.rowCount).toBe(1); // header row only
        });

        it("does not omit a module's placeholder row when it has zero events at all", async () => {
            const curriculum = {
                id: "c2",
                title: "Curriculum",
                startDate: null,
                c2s: [
                    {
                        syllabus: {
                            id: "s1",
                            title: "Syllabus 1",
                            s2m: [{ module: { id: "modEmpty", title: "Module Empty", m2e: [] } }],
                        },
                    },
                ],
                c2w: [
                    {
                        week: {
                            id: "w1",
                            number: 1,
                            w2d: [{ day: { id: "d1", dayIndex: 0, totalWorkingMinutes: 60 } }],
                        },
                    },
                ],
            } as unknown as ApiCurriculum;

            const mappings = [{ dayId: "d1", moduleId: "modEmpty", eventId: null, sortOrder: 0 }];

            const wb = await buildGanttExcelWorkbook(curriculum, mappings);
            const timeline = wb.getWorksheet("לוח זמנים")!;

            const rows: Array<Array<unknown>> = [];
            timeline.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                rows.push(row.values as Array<unknown>);
            });

            const modEmptyRows = rows.filter((r) => r[6] === "Module Empty");
            expect(modEmptyRows).toHaveLength(1);
            expect(modEmptyRows[0][7]).toBe("-");
        });
    });
});
