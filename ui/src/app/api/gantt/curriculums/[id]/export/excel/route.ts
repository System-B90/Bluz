import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";

import { catchHandler } from "@/api-server/common";
import { postgresDb } from "@/api-server/gantt";
import { getConstraintsForCurriculum } from "@/api-server/gantt/db-constraints";
import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { ganttCurriculumEventDayMappingsSchema } from "@/api-server/gantt/schema/mappings";
import { ClientApiError } from "@/api-shared/errors";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { DAY_NAME_DISPLAY } from "@/api-shared/types/gantt/models/day";

export const dynamic = "force-dynamic";

export type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        if (!id) throw new ClientApiError("Curriculum ID is missing.");

        const cid = id as GanttCurriculumId;

        // 1. Fetch full hierarchical curriculum tree
        const curriculum = await DbCurriculum.getItem(cid);

        // 2. Fetch day mappings
        const mappings = await postgresDb
            .select()
            .from(ganttCurriculumEventDayMappingsSchema)
            .where(eq(ganttCurriculumEventDayMappingsSchema.curriculumId, cid));

        // 3. Fetch constraints (needed if we ever display them, fetched for completeness)
        await getConstraintsForCurriculum(cid);

        // 4. Map modules and events for easy lookup
        const moduleMap = new Map<string, { moduleTitle: string; syllabusTitle: string }>();
        const eventMap = new Map<string, { eventTitle: string; allocatedDuration: number }>();
        const syllabusTitles: Array<string> = [];

        if (curriculum.c2s) {
            for (const c2sItem of curriculum.c2s) {
                const syllabus = c2sItem.syllabus;
                if (!syllabus) continue;
                syllabusTitles.push(syllabus.title);
                const syllabusTitle = syllabus.title;
                if (syllabus.s2m) {
                    for (const s2mItem of syllabus.s2m) {
                        const ganttModule = s2mItem.module;
                        if (!ganttModule) continue;
                        const moduleTitle = ganttModule.title;
                        moduleMap.set(ganttModule.id, { moduleTitle, syllabusTitle });
                        if (ganttModule.m2e) {
                            for (const m2eItem of ganttModule.m2e) {
                                const event = m2eItem.event;
                                if (!event) continue;
                                const eventTitle = event.title;
                                const config = event.cEC?.find((c: any) => c.curriculumId === cid);
                                const allocatedDuration = config ? config.allocatedDuration : (event.minimumDuration || 0);
                                eventMap.set(event.id, { eventTitle, allocatedDuration });
                            }
                        }
                    }
                }
            }
        }

        // 5. Build Excel Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Bluz Gantt System";
        workbook.created = new Date();

        // -------------------------------------------------------------
        // Sheet 1: סקירה (Overview)
        // -------------------------------------------------------------
        const overviewSheet = workbook.addWorksheet("סקירה", {
            views: [{ showGridLines: true, rtl: true }],
        });

        // Set column widths
        overviewSheet.columns = [
            { header: "שדה", key: "field", width: 20 },
            { header: "ערך", key: "value", width: 50 },
        ];

        // Format Header Cell (Row 1)
        overviewSheet.mergeCells("A1:B1");
        const overviewHeader = overviewSheet.getCell("A1");
        overviewHeader.value = "פרטי גאנט";
        overviewHeader.font = { name: "Segoe UI", bold: true, size: 14, color: { argb: "FFFFFFFF" } };
        overviewHeader.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF3397AB" }, // Primary Dark Turquoise
        };
        overviewHeader.alignment = { horizontal: "center", vertical: "middle" };

        const startDateFormatted = curriculum.startDate
            ? dayjs(curriculum.startDate).format("DD/MM/YYYY")
            : "לא נקבע";

        const weeks = (curriculum.c2w || [])
            .map((c2wItem: any) => c2wItem.week)
            .filter(Boolean)
            .sort((a: any, b: any) => a.number - b.number);

        const overviewData = [
            { field: "שם הגאנט", value: curriculum.title },
            { field: "תיאור", value: curriculum.description || "-" },
            { field: "תאריך התחלה", value: startDateFormatted },
            { field: "מספר שבועות", value: weeks.length.toString() },
            { field: "סילבוסים כלולים", value: syllabusTitles.join(", ") || "-" },
        ];

        const borderStyle: ExcelJS.Border = {
            top: { style: "thin", color: { argb: "FFD9D9D9" } },
            left: { style: "thin", color: { argb: "FFD9D9D9" } },
            bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
            right: { style: "thin", color: { argb: "FFD9D9D9" } },
        };

        overviewData.forEach((item, index) => {
            const row = overviewSheet.addRow([item.field, item.value]);
            row.height = 24;
            row.eachCell((cell, colNumber) => {
                cell.font = {
                    name: "Segoe UI",
                    bold: colNumber === 1,
                    size: 11,
                    color: { argb: "FF0D2336" }, // Text primary
                };
                cell.alignment = { horizontal: "right", vertical: "middle" };
                cell.border = borderStyle;
                
                // Zebra striping for value cells
                if (index % 2 === 0) {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFF4FAFC" }, // Light Turquoise Tint
                    };
                }
            });
        });

        // -------------------------------------------------------------
        // Sheet 2: לוח זמנים (Timeline)
        // -------------------------------------------------------------
        const timelineSheet = workbook.addWorksheet("לוח זמנים", {
            views: [{ showGridLines: true, rtl: true }],
        });

        const columnsConfig = [
            { header: "שבוע", key: "weekNum", width: 12 },
            { header: "יום בשבוע", key: "hebrewDayName", width: 15 },
            { header: "תאריך", key: "formattedDate", width: 15 },
            { header: "סילבוס", key: "syllabusTitle", width: 25 },
            { header: "מודול", key: "moduleTitle", width: 25 },
            { header: "אירוע", key: "eventTitle", width: 30 },
            { header: "שעות שהוקצו", key: "allocatedHours", width: 15 },
        ];
        timelineSheet.columns = columnsConfig;

        // Style header row
        const headerRow = timelineSheet.getRow(1);
        headerRow.height = 28;
        headerRow.eachCell((cell) => {
            cell.font = { name: "Segoe UI", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF3397AB" }, // Primary Dark Turquoise
            };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = borderStyle;
        });

        const startDate = curriculum.startDate;

        for (let wIdx = 0; wIdx < weeks.length; wIdx++) {
            const week = weeks[wIdx];
            const days = (week.w2d || [])
                .map((w2dItem: any) => w2dItem.day)
                .filter(Boolean)
                .sort((a: any, b: any) => a.dayIndex - b.dayIndex);

            for (const day of days) {
                const dayIndex = day.dayIndex;
                const dayDate = startDate ? dayjs(startDate).add(wIdx * 7 + dayIndex, "day") : null;
                const formattedDate = dayDate ? dayDate.format("DD/MM/YYYY") : "";
                const hebrewDayName = DAY_NAME_DISPLAY[dayIndex] || `יום ${dayIndex + 1}`;

                // Find mappings for this day
                const dayMappings = mappings
                    .filter((m: any) => m.dayId === day.id)
                    .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

                if (dayMappings.length === 0) {
                    const row = timelineSheet.addRow({
                        weekNum: `שבוע ${week.number}`,
                        hebrewDayName,
                        formattedDate,
                        syllabusTitle: "-",
                        moduleTitle: "-",
                        eventTitle: "-",
                        allocatedHours: 0,
                    });
                    row.height = 22;
                    row.eachCell((cell) => {
                        cell.font = { name: "Segoe UI", size: 10, color: { argb: "FF8DA6B5" } }; // Dimmed text
                        cell.alignment = { horizontal: "center", vertical: "middle" };
                        cell.border = borderStyle;
                    });
                } else {
                    for (const mapping of dayMappings) {
                        const modInfo = moduleMap.get(mapping.moduleId);
                        const evInfo = mapping.eventId ? eventMap.get(mapping.eventId) : null;

                        const syllabusTitle = modInfo ? modInfo.syllabusTitle : "-";
                        const moduleTitle = modInfo ? modInfo.moduleTitle : "-";
                        const eventTitle = evInfo ? evInfo.eventTitle : "-";

                        let durationMinutes = 0;
                        if (mapping.eventId && evInfo) {
                            durationMinutes = evInfo.allocatedDuration;
                        }
                        const allocatedHours = durationMinutes / 60;

                        const row = timelineSheet.addRow({
                            weekNum: `שבוע ${week.number}`,
                            hebrewDayName,
                            formattedDate,
                            syllabusTitle,
                            moduleTitle,
                            eventTitle,
                            allocatedHours: allocatedHours > 0 ? allocatedHours : "-",
                        });
                        row.height = 22;
                        row.eachCell((cell, colNumber) => {
                            cell.font = { name: "Segoe UI", size: 10, color: { argb: "FF0D2336" } };
                            // Align number columns or empty dates/weeks to center, texts to right
                            const isCenterAlign = [1, 2, 3, 7].includes(colNumber);
                            cell.alignment = {
                                horizontal: isCenterAlign ? "center" : "right",
                                vertical: "middle",
                            };
                            cell.border = borderStyle;

                            // Number formatting for allocated hours
                            if (colNumber === 7 && typeof allocatedHours === "number" && allocatedHours > 0) {
                                cell.numFmt = "0.0";
                            }
                        });
                    }
                }
            }
        }

        // Apply alternating background colors to weeks in timeline for visual chunking
        let currentWeekText = "";
        let weekColorIndex = 0;
        const weekColors = ["FFFFFF", "FFF4FAFC"]; // alternating row backgrounds

        timelineSheet.eachRow((row, rowIdx) => {
            if (rowIdx === 1) return; // Skip header

            const weekCell = row.getCell(1);
            const weekText = weekCell.text ?? "";
            if (weekText !== currentWeekText) {
                currentWeekText = weekText;
                weekColorIndex = (weekColorIndex + 1) % 2;
            }

            const weekBgColor = weekColors[weekColorIndex];
            row.eachCell((cell) => {
                if (weekBgColor !== "FFFFFF") {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: `FF${weekBgColor}` },
                    };
                }
            });
        });

        // 6. Write to buffer and return response
        const buffer = await workbook.xlsx.writeBuffer();
        const safeTitle = curriculum.title.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, "_");
        const filename = `bluz-gantt-${safeTitle}.xlsx`;
        const encodedFilename = encodeURIComponent(filename);

        const headers = new Headers();
        headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodedFilename}`);
        headers.set("Cache-Control", "no-store, max-age=0");

        return new Response(buffer, {
            status: 200,
            headers,
        });
    } catch (error) {
        return catchHandler(request, error);
    }
}
