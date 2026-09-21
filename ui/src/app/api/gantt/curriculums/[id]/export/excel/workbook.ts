import {
    Workbook,
    type Border,
    type Borders,
    type Cell,
    type CellValue,
    type Row,
    type Worksheet,
} from "@vendor/exceljs";
import dayjs from "dayjs";

import {
    ApiCurriculum,
    ApiModuleEvent,
} from "@/api-shared/types/gantt/api-layer";
import {
    DAY_NAME_DISPLAY,
    GanttDayIndex,
} from "@/api-shared/types/gantt/models/day";
import { EventRecurrence } from "@/api-shared/types/gantt/models/event";

// Maps to CreateFromPalette.ts light-mode palette values.
// ExcelJS requires ARGB (alpha-prefixed) hex strings.
const argb = (hex: string) => `FF${hex}` as const;

const THEME = {
    primary: argb("3397AB"), // palette.primary.dark
    primaryLight: argb("CDEAF0"), // primary tint for group rows
    textPrimary: argb("0D2336"), // palette.text.primary
    textMuted: argb("8DA6B5"), // palette.text.secondary (dark scheme value)
    bgDefault: argb("F4FAFC"), // palette.background.default
    white: argb("FFFFFF"), // palette.background.paper
    border: argb("D9D9D9"), // neutral divider
    success: argb("2E7D32"), // palette.success.main
    inactive: argb("B0B7BD"), // muted neutral for "no" icons
} as const;

// Boolean flag icons (משובץ / קריטי / חלון פ"א) rendered instead of כן/לא text.
export const BOOL_ICON = { yes: "✓", no: "✗" } as const;

const RECURRENCE_DISPLAY: Record<EventRecurrence, string> = {
    [EventRecurrence.None]: "ללא",
    [EventRecurrence.Daily]: "יומי",
    [EventRecurrence.Weekly]: "שבועי",
};

export type DayMapping = {
    dayId: string;
    moduleId: string;
    eventId: null | string;
    sortOrder: null | number;
};

const BORDER_SIDE: Partial<Border> = {
    style: "thin",
    color: { argb: THEME.border },
};
const BORDER_STYLE: Partial<Borders> = {
    top: BORDER_SIDE,
    left: BORDER_SIDE,
    bottom: BORDER_SIDE,
    right: BORDER_SIDE,
};

function applyHeaderCell(cell: Cell): void {
    cell.font = {
        name: "Segoe UI",
        bold: true,
        size: 11,
        color: { argb: THEME.white },
    };
    cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: THEME.primary },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER_STYLE;
}

// Paint every column of a row (including empty cells), so group/summary rows
// keep a continuous fill across the sheet width.
function paintRow(
    row: Row,
    colCount: number,
    styler: (cell: Cell, colNumber: number) => void,
): void {
    for (let c = 1; c <= colCount; c++) styler(row.getCell(c), c);
}

const minutesToHours = (minutes: number) =>
    Math.round((minutes / 60) * 100) / 100;

// Merges runs of consecutive rows in a column that share the same value
// (e.g. repeated סילבוס/מודול names), so each distinct value appears once.
function mergeConsecutiveIdenticalCells(
    sheet: Worksheet,
    col: number,
    firstRow: number,
    lastRow: number,
): void {
    const END_OF_RANGE = Symbol("end");
    let runStart = firstRow;
    let runValue: CellValue | typeof END_OF_RANGE = sheet.getCell(
        runStart,
        col,
    ).value;
    for (let r = firstRow + 1; r <= lastRow + 1; r++) {
        const value: CellValue | typeof END_OF_RANGE =
            r <= lastRow ? sheet.getCell(r, col).value : END_OF_RANGE;
        if (value !== runValue) {
            if (r - 1 > runStart) sheet.mergeCells(runStart, col, r - 1, col);
            runStart = r;
            runValue = value;
        }
    }
}

/**
 * The "אחראי" column shows a person, so it must read as one. Hive is the
 * source of names; an id that Hive does not know still prints, so the export
 * never silently loses the assignment (#466).
 */
function makeOrchestratorLabel(userNamesById: Map<number, string>) {
    return (orchestratorId: null | number | undefined): string => {
        if (orchestratorId === null || orchestratorId === undefined) return "-";
        return userNamesById.get(orchestratorId) ?? String(orchestratorId);
    };
}

export async function buildGanttExcelWorkbook(
    curriculum: ApiCurriculum,
    mappings: Array<DayMapping>,
    /** Hive user id → display name. Missing ids fall back to the raw id. */
    userNamesById: Map<number, string> = new Map(),
): Promise<Workbook> {
    const orchestratorLabel = makeOrchestratorLabel(userNamesById);

    const workbook = new Workbook();
    workbook.creator = "Bluz Gantt System";
    workbook.created = new Date();

    // ── Build lookup maps ────────────────────────────────────────────────────

    const moduleMap = new Map<
        string,
        { moduleTitle: string; syllabusTitle: string }
    >();
    const eventMap = new Map<
        string,
        { eventTitle: string; allocatedDuration: number }
    >();
    const moduleEventIds = new Map<string, Array<string>>();
    const syllabusTitles: Array<string> = [];

    // Per-curriculum required duration for an event (allocated, else minimum).
    const eventRequiredMinutes = (event: ApiModuleEvent): number => {
        const config = event.cEC?.find((c) => c.curriculumId === curriculum.id);
        return config?.allocatedDuration ?? event.minimumDuration ?? 0;
    };

    for (const c2sItem of curriculum.c2s ?? []) {
        const syllabus = c2sItem.syllabus;
        if (!syllabus) continue;
        syllabusTitles.push(syllabus.title);
        for (const s2mItem of syllabus.s2m ?? []) {
            const mod = s2mItem.module;
            if (!mod) continue;
            moduleMap.set(mod.id, {
                moduleTitle: mod.title,
                syllabusTitle: syllabus.title,
            });
            const eventIds: Array<string> = [];
            for (const m2eItem of mod.m2e ?? []) {
                const event = m2eItem.event;
                if (!event) continue;
                eventMap.set(event.id, {
                    eventTitle: event.title,
                    allocatedDuration: eventRequiredMinutes(event),
                });
                eventIds.push(event.id);
            }
            moduleEventIds.set(mod.id, eventIds);
        }
    }

    // Event ids that are actually placed on a day in the timeline.
    const allocatedEventIds = new Set(
        mappings.filter((m) => m.eventId).map((m) => m.eventId as string),
    );

    // A module whose every event has already been placed on a day no longer needs
    // its own unassigned-slot placeholder row in the timeline.
    const isModuleFullyAllocated = (moduleId: string): boolean => {
        const eventIds = moduleEventIds.get(moduleId) ?? [];
        return (
            eventIds.length > 0 &&
            eventIds.every((id) => allocatedEventIds.has(id))
        );
    };

    const weeks = (curriculum.c2w ?? [])
        .map((c2wItem) => c2wItem.week)
        .filter(Boolean)
        .sort((a, b) => a.number - b.number);

    // ── Curriculum-wide aggregates (end date + total working hours) ──────────

    let totalWorkingMinutes = 0;
    let maxDayOffset = -1;
    weeks.forEach((week, wIdx) => {
        for (const w2dItem of week.w2d ?? []) {
            const day = w2dItem.day;
            if (!day) continue;
            totalWorkingMinutes += day.totalWorkingMinutes ?? 0;
            const offset = wIdx * 7 + (day.dayIndex as number);
            if (offset > maxDayOffset) maxDayOffset = offset;
        }
    });

    const startDateFormatted = curriculum.startDate
        ? dayjs(curriculum.startDate).format("DD/MM/YYYY")
        : "לא נקבע";
    const endDateFormatted =
        curriculum.startDate && maxDayOffset >= 0
            ? dayjs(curriculum.startDate)
                .add(maxDayOffset, "day")
                .format("DD/MM/YYYY")
            : "לא נקבע";

    // ── Sheet 1: סקירה (Overview) ────────────────────────────────────────────

    const overviewSheet = workbook.addWorksheet("סקירה", {
        views: [{ showGridLines: true, rightToLeft: true }],
    });

    overviewSheet.columns = [
        { header: "שדה", key: "field", width: 22 },
        { header: "ערך", key: "value", width: 50 },
    ];

    overviewSheet.mergeCells("A1:B1");
    const overviewHeader = overviewSheet.getCell("A1");
    overviewHeader.value = "פרטי גאנט";
    overviewHeader.font = {
        name: "Segoe UI",
        bold: true,
        size: 14,
        color: { argb: THEME.white },
    };
    overviewHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: THEME.primary },
    };
    overviewHeader.alignment = { horizontal: "center", vertical: "middle" };

    const overviewData = [
        { field: "שם הגאנט", value: curriculum.title },
        { field: "תיאור", value: curriculum.description || "-" },
        { field: "תאריך התחלה", value: startDateFormatted },
        { field: "תאריך סיום", value: endDateFormatted },
        { field: "מספר שבועות", value: weeks.length.toString() },
        {
            field: "סך שעות עבודה",
            value: minutesToHours(totalWorkingMinutes).toString(),
        },
        { field: "סילבוסים כלולים", value: syllabusTitles.join(", ") || "-" },
    ];

    overviewData.forEach((item, index) => {
        const row = overviewSheet.addRow([item.field, item.value]);
        row.height = 24;
        row.eachCell((cell, colNumber) => {
            cell.font = {
                name: "Segoe UI",
                bold: colNumber === 1,
                size: 11,
                color: { argb: THEME.textPrimary },
            };
            cell.alignment = { horizontal: "right", vertical: "middle" };
            cell.border = BORDER_STYLE;
            if (index % 2 === 0) {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: THEME.bgDefault },
                };
            }
        });
    });

    // ── Sheet 2: לוח זמנים (Timeline) ────────────────────────────────────────

    const timelineSheet = workbook.addWorksheet("לוח זמנים", {
        views: [{ showGridLines: true, rightToLeft: true }],
        properties: {
            outlineProperties: { summaryBelow: false, summaryRight: false },
        },
    });

    timelineSheet.columns = [
        { header: "שבוע", key: "weekNum", width: 10 },
        { header: "שם השבוע", key: "weekName", width: 16 },
        { header: "יום בשבוע", key: "hebrewDayName", width: 15 },
        { header: "תאריך", key: "formattedDate", width: 15 },
        { header: "סילבוס", key: "syllabusTitle", width: 25 },
        { header: "מערך", key: "moduleTitle", width: 25 },
        { header: "מופע", key: "eventTitle", width: 30 },
        { header: "שעות שהוקצו", key: "allocatedHours", width: 15 },
    ];

    const TIMELINE_COLS = 8;
    const timelineHeaderRow = timelineSheet.getRow(1);
    timelineHeaderRow.height = 28;
    paintRow(timelineHeaderRow, TIMELINE_COLS, applyHeaderCell);

    for (let wIdx = 0; wIdx < weeks.length; wIdx++) {
        const week = weeks[wIdx];
        const weekName = week.comment?.trim() || "ללא הערה";
        const days = (week.w2d ?? [])
            .map((w2dItem) => w2dItem.day)
            .filter(Boolean)
            .sort((a, b) => a.dayIndex - b.dayIndex);

        // Collapsible week header (also acts as the week summary row).
        const weekHeaderRow = timelineSheet.addRow({
            weekNum: `שבוע ${week.number}`,
            weekName,
        });
        weekHeaderRow.outlineLevel = 0;
        weekHeaderRow.height = 24;
        let weekTotalHours = 0;
        const weekStartRow = weekHeaderRow.number;

        for (const day of days) {
            const dayIndex = day.dayIndex as GanttDayIndex;
            const dayDate = curriculum.startDate
                ? dayjs(curriculum.startDate).add(wIdx * 7 + dayIndex, "day")
                : null;
            const formattedDate = dayDate?.format("DD/MM/YYYY") ?? "";
            const hebrewDayName =
                DAY_NAME_DISPLAY[dayIndex] ?? `יום ${dayIndex + 1}`;

            const dayMappings = mappings
                .filter((m) => m.dayId === day.id)
                .filter((m) => m.eventId || !isModuleFullyAllocated(m.moduleId))
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

            let dayStartRow: number;
            let dayEndRow: number;

            if (dayMappings.length === 0) {
                const row = timelineSheet.addRow({
                    weekNum: `שבוע ${week.number}`,
                    weekName,
                    hebrewDayName,
                    formattedDate,
                    syllabusTitle: "-",
                    moduleTitle: "-",
                    eventTitle: "-",
                    allocatedHours: 0,
                });
                row.outlineLevel = 1;
                row.height = 22;
                paintRow(row, TIMELINE_COLS, (cell) => {
                    cell.font = {
                        name: "Segoe UI",
                        size: 10,
                        color: { argb: THEME.textMuted },
                    };
                    cell.alignment = {
                        horizontal: "center",
                        vertical: "middle",
                    };
                    cell.border = BORDER_STYLE;
                });
                dayStartRow = dayEndRow = row.number;
            } else {
                dayStartRow = timelineSheet.rowCount + 1;
                for (const mapping of dayMappings) {
                    const modInfo = moduleMap.get(mapping.moduleId);
                    const evInfo = mapping.eventId
                        ? eventMap.get(mapping.eventId)
                        : null;
                    const allocatedHours = minutesToHours(
                        evInfo?.allocatedDuration ?? 0,
                    );
                    weekTotalHours += allocatedHours;

                    const row = timelineSheet.addRow({
                        weekNum: `שבוע ${week.number}`,
                        weekName,
                        hebrewDayName,
                        formattedDate,
                        syllabusTitle: modInfo?.syllabusTitle ?? "-",
                        moduleTitle: modInfo?.moduleTitle ?? "-",
                        eventTitle: evInfo?.eventTitle ?? "-",
                        allocatedHours:
                            allocatedHours > 0 ? allocatedHours : "-",
                    });
                    row.outlineLevel = 1;
                    row.height = 22;
                    paintRow(row, TIMELINE_COLS, (cell, colNumber) => {
                        cell.font = {
                            name: "Segoe UI",
                            size: 10,
                            color: { argb: THEME.textPrimary },
                        };
                        cell.alignment = {
                            horizontal: [1, 3, 4, 8].includes(colNumber)
                                ? "center"
                                : "right",
                            vertical: "middle",
                        };
                        cell.border = BORDER_STYLE;
                        if (colNumber === 8 && allocatedHours > 0) {
                            cell.numFmt = "0.0";
                        }
                    });
                }
                dayEndRow = timelineSheet.rowCount;
            }

            // Merge the day-name and date columns across every row for this day.
            if (dayEndRow > dayStartRow) {
                timelineSheet.mergeCells(dayStartRow, 3, dayEndRow, 3);
                timelineSheet.mergeCells(dayStartRow, 4, dayEndRow, 4);
            }
        }

        // Merge the week-number and week-name columns across every row for this week.
        const weekEndRow = timelineSheet.rowCount;
        if (weekEndRow > weekStartRow) {
            timelineSheet.mergeCells(weekStartRow, 1, weekEndRow, 1);
            timelineSheet.mergeCells(weekStartRow, 2, weekEndRow, 2);
        }

        // Fill the week summary total now that all day rows are accounted for.
        weekHeaderRow.getCell(8).value =
            weekTotalHours > 0 ? weekTotalHours : "-";
        paintRow(weekHeaderRow, TIMELINE_COLS, (cell, colNumber) => {
            cell.font = {
                name: "Segoe UI",
                bold: true,
                size: 11,
                color: { argb: THEME.textPrimary },
            };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: THEME.primaryLight },
            };
            cell.alignment = {
                horizontal: colNumber === 2 ? "right" : "center",
                vertical: "middle",
            };
            cell.border = BORDER_STYLE;
            if (colNumber === 8 && weekTotalHours > 0) cell.numFmt = "0.0";
        });
    }

    // Merge repeated סילבוס/מודול values across consecutive rows, mirroring the
    // week/day column merges above.
    if (timelineSheet.rowCount > 1) {
        mergeConsecutiveIdenticalCells(
            timelineSheet,
            5,
            2,
            timelineSheet.rowCount,
        );
        mergeConsecutiveIdenticalCells(
            timelineSheet,
            6,
            2,
            timelineSheet.rowCount,
        );
    }

    // ── Sheet 3: פירוט סילבוסים (By-syllabus deep dive) ──────────────────────

    const detailSheet = workbook.addWorksheet("פירוט סילבוסים", {
        views: [{ showGridLines: true, rightToLeft: true }],
        properties: {
            outlineProperties: { summaryBelow: false, summaryRight: false },
        },
    });

    detailSheet.columns = [
        { header: "סילבוס", key: "syllabus", width: 24 },
        { header: "מערך", key: "module", width: 24 },
        { header: "מופע", key: "event", width: 28 },
        { header: "סוג", key: "type", width: 12 },
        { header: "משובץ", key: "isAllocated", width: 10 },
        { header: "שעות מינ'", key: "minHours", width: 11 },
        { header: "שעות נדרשות", key: "requiredHours", width: 12 },
        { header: "אחראי", key: "orchestrator", width: 20 },
        { header: "דרישת חדר", key: "room", width: 16 },
        { header: "חזרתיות", key: "recurrence", width: 11 },
        { header: "קריטי", key: "isCritical", width: 9 },
        { header: 'חלון פ"א', key: "isPaWindow", width: 11 },
        { header: "דרישות מערכת", key: "systemReqs", width: 26 },
        { header: "הערות", key: "comment", width: 30 },
    ];

    const DETAIL_COLS = 14;
    const REQUIRED_COL = 7; // "שעות נדרשות" column index used for summary totals.
    const detailHeaderRow = detailSheet.getRow(1);
    detailHeaderRow.height = 28;
    paintRow(detailHeaderRow, DETAIL_COLS, applyHeaderCell);

    let eventRowParity = 0;

    for (const c2sItem of curriculum.c2s ?? []) {
        const syllabus = c2sItem.syllabus;
        if (!syllabus) continue;

        // Syllabus header / summary row (outline level 0).
        const syllabusRow = detailSheet.addRow({ syllabus: syllabus.title });
        syllabusRow.outlineLevel = 0;
        syllabusRow.height = 24;
        let syllabusTotalMinutes = 0;
        const syllabusStartRow = syllabusRow.number;

        for (const s2mItem of syllabus.s2m ?? []) {
            const mod = s2mItem.module;
            if (!mod) continue;

            // Module header / summary row (outline level 1).
            const moduleRow = detailSheet.addRow({ module: mod.title });
            moduleRow.outlineLevel = 1;
            moduleRow.height = 22;
            let moduleTotalMinutes = 0;
            const moduleStartRow = moduleRow.number;

            for (const m2eItem of mod.m2e ?? []) {
                const event = m2eItem.event;
                if (!event) continue;

                const requiredMinutes = eventRequiredMinutes(event);
                moduleTotalMinutes += requiredMinutes;

                const row = detailSheet.addRow({
                    syllabus: "",
                    module: "",
                    event: event.title,
                    type: event.type ?? "-",
                    isAllocated: allocatedEventIds.has(event.id)
                        ? BOOL_ICON.yes
                        : BOOL_ICON.no,
                    minHours: minutesToHours(event.minimumDuration ?? 0),
                    requiredHours: minutesToHours(requiredMinutes),
                    orchestrator: orchestratorLabel(event.orchestratorId),
                    room: event.roomRequirement ?? "-",
                    recurrence:
                        RECURRENCE_DISPLAY[event.recurrence] ??
                        event.recurrence ??
                        "-",
                    isCritical: event.isCritical ? BOOL_ICON.yes : BOOL_ICON.no,
                    isPaWindow: event.isPaWindow ? BOOL_ICON.yes : BOOL_ICON.no,
                    systemReqs:
                        (event.systemRequirements ?? []).join(", ") || "-",
                    comment: event.comment || "-",
                });
                row.outlineLevel = 2;
                row.height = 20;
                const stripe = eventRowParity++ % 2 === 0;
                const BOOL_ICON_COLS = [5, 11, 12]; // isAllocated, isCritical, isPaWindow
                paintRow(row, DETAIL_COLS, (cell, colNumber) => {
                    const isBoolIcon = BOOL_ICON_COLS.includes(colNumber);
                    cell.font = {
                        name: "Segoe UI",
                        size: isBoolIcon ? 12 : 10,
                        bold: isBoolIcon,
                        color: {
                            argb: isBoolIcon
                                ? cell.value === BOOL_ICON.yes
                                    ? THEME.success
                                    : THEME.inactive
                                : THEME.textPrimary,
                        },
                    };
                    cell.alignment = {
                        horizontal: [3, 13, 14].includes(colNumber)
                            ? "right"
                            : "center",
                        vertical: "middle",
                        wrapText: [13, 14].includes(colNumber),
                    };
                    cell.border = BORDER_STYLE;
                    if ([6, 7].includes(colNumber)) cell.numFmt = "0.0";
                    if (stripe) {
                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: THEME.bgDefault },
                        };
                    }
                });
            }

            syllabusTotalMinutes += moduleTotalMinutes;

            // Merge the module column across the module row and its event rows.
            const moduleEndRow = detailSheet.rowCount;
            if (moduleEndRow > moduleStartRow) {
                detailSheet.mergeCells(moduleStartRow, 2, moduleEndRow, 2);
            }

            // Backfill the module summary total.
            moduleRow.getCell(REQUIRED_COL).value =
                minutesToHours(moduleTotalMinutes);
            paintRow(moduleRow, DETAIL_COLS, (cell, colNumber) => {
                cell.font = {
                    name: "Segoe UI",
                    bold: true,
                    size: 11,
                    color: { argb: THEME.textPrimary },
                };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: THEME.primaryLight },
                };
                cell.alignment = {
                    horizontal: colNumber === 2 ? "right" : "center",
                    vertical: "middle",
                };
                cell.border = BORDER_STYLE;
                if (colNumber === REQUIRED_COL) cell.numFmt = "0.0";
            });
        }

        // Merge the syllabus column across the syllabus row and all its module/event rows.
        const syllabusEndRow = detailSheet.rowCount;
        if (syllabusEndRow > syllabusStartRow) {
            detailSheet.mergeCells(syllabusStartRow, 1, syllabusEndRow, 1);
        }

        // Backfill the syllabus summary total.
        syllabusRow.getCell(REQUIRED_COL).value =
            minutesToHours(syllabusTotalMinutes);
        paintRow(syllabusRow, DETAIL_COLS, (cell, colNumber) => {
            cell.font = {
                name: "Segoe UI",
                bold: true,
                size: 12,
                color: { argb: THEME.white },
            };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: THEME.primary },
            };
            cell.alignment = {
                horizontal: colNumber === 1 ? "right" : "center",
                vertical: "middle",
            };
            cell.border = BORDER_STYLE;
            if (colNumber === REQUIRED_COL) cell.numFmt = "0.0";
        });
    }

    return workbook;
}
