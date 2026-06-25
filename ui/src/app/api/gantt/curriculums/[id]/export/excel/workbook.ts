import dayjs from "dayjs";
import ExcelJS from "exceljs";

import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import { DAY_NAME_DISPLAY, GanttDayIndex } from "@/api-shared/types/gantt/models/day";

// Maps to CreateFromPalette.ts light-mode palette values.
// ExcelJS requires ARGB (alpha-prefixed) hex strings.
const argb = (hex: string) => `FF${hex}` as const;

const THEME = {
    primary:     argb("3397AB"), // palette.primary.dark
    textPrimary: argb("0D2336"), // palette.text.primary
    textMuted:   argb("8DA6B5"), // palette.text.secondary (dark scheme value)
    bgDefault:   argb("F4FAFC"), // palette.background.default
    white:       argb("FFFFFF"), // palette.background.paper
    border:      argb("D9D9D9"), // neutral divider
} as const;

export type DayMapping = {
    dayId: string;
    moduleId: string;
    eventId: null | string;
    sortOrder: null | number;
};

const BORDER_SIDE: Partial<ExcelJS.Border> = { style: "thin", color: { argb: THEME.border } };
const BORDER_STYLE: Partial<ExcelJS.Borders> = {
    top: BORDER_SIDE, left: BORDER_SIDE, bottom: BORDER_SIDE, right: BORDER_SIDE,
};

function applyHeaderCell(cell: ExcelJS.Cell): void {
    cell.font = { name: "Segoe UI", bold: true, size: 11, color: { argb: THEME.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.primary } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER_STYLE;
}

export async function buildGanttExcelWorkbook(
    curriculum: ApiCurriculum,
    mappings: Array<DayMapping>,
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Bluz Gantt System";
    workbook.created = new Date();

    // ── Build lookup maps ────────────────────────────────────────────────────

    const moduleMap = new Map<string, { moduleTitle: string; syllabusTitle: string }>();
    const eventMap = new Map<string, { eventTitle: string; allocatedDuration: number }>();
    const syllabusTitles: Array<string> = [];

    for (const c2sItem of curriculum.c2s ?? []) {
        const syllabus = c2sItem.syllabus;
        if (!syllabus) continue;
        syllabusTitles.push(syllabus.title);
        for (const s2mItem of syllabus.s2m ?? []) {
            const mod = s2mItem.module;
            if (!mod) continue;
            moduleMap.set(mod.id, { moduleTitle: mod.title, syllabusTitle: syllabus.title });
            for (const m2eItem of mod.m2e ?? []) {
                const event = m2eItem.event;
                if (!event) continue;
                const config = event.cEC?.find((c) => c.curriculumId === curriculum.id);
                eventMap.set(event.id, {
                    eventTitle: event.title,
                    allocatedDuration: config?.allocatedDuration ?? event.minimumDuration ?? 0,
                });
            }
        }
    }

    const weeks = (curriculum.c2w ?? [])
        .map((c2wItem) => c2wItem.week)
        .filter(Boolean)
        .sort((a, b) => a.number - b.number);

    // ── Sheet 1: סקירה (Overview) ────────────────────────────────────────────

    const overviewSheet = workbook.addWorksheet("סקירה", {
        views: [{ showGridLines: true, rightToLeft: true }],
    });

    overviewSheet.columns = [
        { header: "שדה",  key: "field", width: 20 },
        { header: "ערך",  key: "value", width: 50 },
    ];

    overviewSheet.mergeCells("A1:B1");
    const overviewHeader = overviewSheet.getCell("A1");
    overviewHeader.value = "פרטי גאנט";
    overviewHeader.font = { name: "Segoe UI", bold: true, size: 14, color: { argb: THEME.white } };
    overviewHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.primary } };
    overviewHeader.alignment = { horizontal: "center", vertical: "middle" };

    const startDateFormatted = curriculum.startDate
        ? dayjs(curriculum.startDate).format("DD/MM/YYYY")
        : "לא נקבע";

    const overviewData = [
        { field: "שם הגאנט",      value: curriculum.title },
        { field: "תיאור",          value: curriculum.description || "-" },
        { field: "תאריך התחלה",   value: startDateFormatted },
        { field: "מספר שבועות",   value: weeks.length.toString() },
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
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.bgDefault } };
            }
        });
    });

    // ── Sheet 2: לוח זמנים (Timeline) ────────────────────────────────────────

    const timelineSheet = workbook.addWorksheet("לוח זמנים", {
        views: [{ showGridLines: true, rightToLeft: true }],
    });

    timelineSheet.columns = [
        { header: "שבוע",         key: "weekNum",        width: 12 },
        { header: "יום בשבוע",    key: "hebrewDayName",  width: 15 },
        { header: "תאריך",        key: "formattedDate",  width: 15 },
        { header: "סילבוס",       key: "syllabusTitle",  width: 25 },
        { header: "מודול",        key: "moduleTitle",    width: 25 },
        { header: "אירוע",        key: "eventTitle",     width: 30 },
        { header: "שעות שהוקצו", key: "allocatedHours", width: 15 },
    ];

    const timelineHeaderRow = timelineSheet.getRow(1);
    timelineHeaderRow.height = 28;
    timelineHeaderRow.eachCell(applyHeaderCell);

    for (let wIdx = 0; wIdx < weeks.length; wIdx++) {
        const week = weeks[wIdx];
        const days = (week.w2d ?? [])
            .map((w2dItem) => w2dItem.day)
            .filter(Boolean)
            .sort((a, b) => a.dayIndex - b.dayIndex);

        for (const day of days) {
            const dayIndex = day.dayIndex as GanttDayIndex;
            const dayDate = curriculum.startDate
                ? dayjs(curriculum.startDate).add(wIdx * 7 + dayIndex, "day")
                : null;
            const formattedDate = dayDate?.format("DD/MM/YYYY") ?? "";
            const hebrewDayName = DAY_NAME_DISPLAY[dayIndex] ?? `יום ${dayIndex + 1}`;

            const dayMappings = mappings
                .filter((m) => m.dayId === day.id)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

            if (dayMappings.length === 0) {
                const row = timelineSheet.addRow({
                    weekNum: `שבוע ${week.number}`,
                    hebrewDayName,
                    formattedDate,
                    syllabusTitle:  "-",
                    moduleTitle:    "-",
                    eventTitle:     "-",
                    allocatedHours: 0,
                });
                row.height = 22;
                row.eachCell((cell) => {
                    cell.font = { name: "Segoe UI", size: 10, color: { argb: THEME.textMuted } };
                    cell.alignment = { horizontal: "center", vertical: "middle" };
                    cell.border = BORDER_STYLE;
                });
            } else {
                for (const mapping of dayMappings) {
                    const modInfo = moduleMap.get(mapping.moduleId);
                    const evInfo = mapping.eventId ? eventMap.get(mapping.eventId) : null;
                    const allocatedHours = (evInfo?.allocatedDuration ?? 0) / 60;

                    const row = timelineSheet.addRow({
                        weekNum:        `שבוע ${week.number}`,
                        hebrewDayName,
                        formattedDate,
                        syllabusTitle:  modInfo?.syllabusTitle ?? "-",
                        moduleTitle:    modInfo?.moduleTitle   ?? "-",
                        eventTitle:     evInfo?.eventTitle     ?? "-",
                        allocatedHours: allocatedHours > 0 ? allocatedHours : "-",
                    });
                    row.height = 22;
                    row.eachCell((cell, colNumber) => {
                        cell.font = { name: "Segoe UI", size: 10, color: { argb: THEME.textPrimary } };
                        cell.alignment = {
                            horizontal: [1, 2, 3, 7].includes(colNumber) ? "center" : "right",
                            vertical: "middle",
                        };
                        cell.border = BORDER_STYLE;
                        if (colNumber === 7 && typeof allocatedHours === "number" && allocatedHours > 0) {
                            cell.numFmt = "0.0";
                        }
                    });
                }
            }
        }
    }

    // Alternating week backgrounds
    let currentWeekText = "";
    let weekColorIndex = 0;
    timelineSheet.eachRow((row, rowIdx) => {
        if (rowIdx === 1) return;
        const weekText = row.getCell(1).text ?? "";
        if (weekText !== currentWeekText) {
            currentWeekText = weekText;
            weekColorIndex = (weekColorIndex + 1) % 2;
        }
        if (weekColorIndex === 1) {
            row.eachCell((cell) => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.bgDefault } };
            });
        }
    });

    return workbook;
}
