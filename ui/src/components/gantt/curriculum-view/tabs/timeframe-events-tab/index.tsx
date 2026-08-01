"use client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo, useState } from "react";

import { ApiCutPreviewOccurrence } from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    PREVIEW_BUTTON_GROUP_SX,
    PreviewLayout,
    PreviewToolbar,
    renderPreviewBlockers,
} from "@/components/gantt/curriculum-view/tabs/cut-preview-tab/PreviewShell";
import { useCutPreview } from "@/components/gantt/curriculum-view/tabs/cut-preview-tab/UseCutPreview";

export type TimeframeEventsTabProps = {
    curriculumId: GanttCurriculumId;
};

type TimeframePreset = "month" | "two-weeks" | "week";

const PRESET_DAYS: Record<TimeframePreset, number> = {
    week: 7,
    "two-weeks": 14,
    month: 30,
};

const PRESET_LABELS: Record<TimeframePreset, string> = {
    week: "שבוע",
    "two-weeks": "שבועיים",
    month: "חודש",
};

const DAY_NAMES = [
    "יום ראשון",
    "יום שני",
    "יום שלישי",
    "יום רביעי",
    "יום חמישי",
    "יום שישי",
    "שבת",
] as const;

function OccurrenceRow({ occ }: { occ: ApiCutPreviewOccurrence }) {
    const start = dayjs(occ.startTime);
    const end = dayjs(occ.endTime);
    return (
        <Box
            alignItems="center"
            display="flex"
            gap={1.5}
            sx={{
                p: 1,
                borderRadius: "10px",
                border: "1px solid",
                borderColor: "divider",
                opacity: occ.isRecurrenceEcho ? 0.7 : 1,
            }}
        >
            <Typography
                sx={{
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    minWidth: 96,
                    color: "text.secondary",
                }}
            >
                {start.format("HH:mm")}–{end.format("HH:mm")}
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                {occ.title}
            </Typography>
            <Chip label={occ.eventType} size="small" variant="outlined" />
            {occ.moduleTitle ? (
                <Typography
                    sx={{ fontSize: "0.75rem", color: "text.secondary" }}
                >
                    {occ.moduleTitle} · {occ.syllabusTitle}
                </Typography>
            ) : null}
            {occ.isRecurrenceEcho ? (
                <Chip color="info" label="מופע חוזר" size="small" />
            ) : null}
        </Box>
    );
}

/**
 * All planned occurrences within a chosen timeframe (default: one week from
 * the curriculum start), grouped by day — a flat agenda over the same cut
 * preview data the week-preview tab renders as a timetable.
 */
export function TimeframeEventsTab({ curriculumId }: TimeframeEventsTabProps) {
    const preview = useCutPreview(curriculumId);
    const [preset, setPreset] = useState<TimeframePreset>("week");
    const [anchor, setAnchor] = useState<Dayjs | null>(null);

    const occurrences = useMemo(
        () =>
            preview.kind === "ready" && preview.data.ok
                ? preview.data.occurrences
                : [],
        [preview],
    );

    const firstDate = useMemo(
        () =>
            occurrences.length > 0
                ? occurrences.reduce(
                    (min, occ) =>
                        occ.occurrenceDate < min ? occ.occurrenceDate : min,
                    occurrences[0].occurrenceDate,
                )
                : dayjs().format("YYYY-MM-DD"),
        [occurrences],
    );

    const rangeStart = (anchor ?? dayjs(firstDate)).startOf("day");
    const rangeEnd = rangeStart.add(PRESET_DAYS[preset], "day");

    const navigate = useCallback(
        (direction: "next" | "prev" | "start") => {
            if (direction === "start") {
                setAnchor(null);
                return;
            }
            const days = PRESET_DAYS[preset];
            setAnchor(
                rangeStart.add(direction === "next" ? days : -days, "day"),
            );
        },
        [preset, rangeStart],
    );

    const grouped = useMemo(() => {
        const inRange = occurrences.filter((occ) => {
            const date = dayjs(occ.occurrenceDate);
            return (
                !date.isBefore(rangeStart, "day") &&
                date.isBefore(rangeEnd, "day")
            );
        });
        const byDate = new Map<string, Array<ApiCutPreviewOccurrence>>();
        for (const occ of inRange) {
            const arr = byDate.get(occ.occurrenceDate) ?? [];
            arr.push(occ);
            byDate.set(occ.occurrenceDate, arr);
        }
        return [...byDate.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dayOccurrences]) => ({
                date,
                occurrences: dayOccurrences.sort((a, b) =>
                    a.startTime.localeCompare(b.startTime),
                ),
            }));
    }, [occurrences, rangeStart, rangeEnd]);

    const blockers = renderPreviewBlockers(preview);
    if (blockers) return blockers;

    return (
        <PreviewLayout>
            <PreviewToolbar
                onNavigate={navigate}
                title={
                    <Typography fontWeight="bold" variant="subtitle1">
                        {rangeStart.format("DD/MM/YYYY")} –{" "}
                        {rangeEnd.subtract(1, "day").format("DD/MM/YYYY")}
                    </Typography>
                }
            >
                <ButtonGroup
                    size="small"
                    sx={PREVIEW_BUTTON_GROUP_SX}
                    variant="outlined"
                >
                    {(
                        ["week", "two-weeks", "month"] as Array<TimeframePreset>
                    ).map((option) => (
                        <Button
                            key={option}
                            onClick={() => setPreset(option)}
                            variant={
                                preset === option ? "contained" : "outlined"
                            }
                        >
                            {PRESET_LABELS[option]}
                        </Button>
                    ))}
                </ButtonGroup>
            </PreviewToolbar>
            {preview.kind === "ready" &&
            preview.data.ok &&
            preview.data.skipped.length > 0 ? (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                        {preview.data.skipped.length} אירועים לא משובצים הושמטו
                    מהרשימה
                    </Alert>
                ) : null}
            <Box flexGrow={1} minHeight={0} sx={{ overflowY: "auto", pr: 0.5 }}>
                {grouped.length === 0 ? (
                    <Alert severity="info" sx={{ m: 2 }}>
                        אין אירועים מתוכננים בטווח שנבחר
                    </Alert>
                ) : (
                    <Stack gap={2} pb={2}>
                        {grouped.map(({ date, occurrences: dayOccurrences }) => {
                            const day = dayjs(date);
                            return (
                                <Box key={date}>
                                    <Divider sx={{ mb: 1 }} textAlign="right">
                                        <Typography
                                            sx={{
                                                fontWeight: 800,
                                                fontSize: "0.85rem",
                                            }}
                                        >
                                            {DAY_NAMES[day.day()]},{" "}
                                            {day.format("DD/MM/YYYY")}
                                        </Typography>
                                    </Divider>
                                    <Stack gap={1}>
                                        {dayOccurrences.map((occ) => (
                                            <OccurrenceRow
                                                key={`${occ.ganttEventId}:${occ.occurrenceDate}`}
                                                occ={occ}
                                            />
                                        ))}
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </Box>
        </PreviewLayout>
    );
}
