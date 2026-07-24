"use client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { Calendar, Messages, View } from "react-big-calendar";

import { CutValidationError } from "@/api-shared/gantt/cut-planner";
import {
    ApiCutPreviewOccurrence,
} from "@/api-shared/types/gantt/cut";
import {
    GanttCurriculumId,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { useCustomColors } from "@/components/base/CustomColorsProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { CALENDAR_MESSAGES } from "@/components/CalendarMessages";
import { useCutPreview } from "@/components/gantt/curriculum-view/tabs/cut-preview-tab/UseCutPreview";
import { localizer } from "@/components/schedule/calendar/calendar/DndLocalizer";
import { resolveEventColor } from "@/components/schedule/event-component/event-colors";

export type CutPreviewTabProps = {
    curriculumId: GanttCurriculumId;
};

type PreviewCalendarEvent = {
    title: string;
    start: Date;
    end: Date;
    resource: ApiCutPreviewOccurrence;
};

function describeValidationError(error: CutValidationError): string {
    switch (error.type) {
    case "missing-start-date":
        return "לתוכנית הלימודים אין תאריך התחלה — קבעו תאריך התחלה כדי לראות תצוגה מקדימה";
    case "unmapped-event":
        return `האירוע "${error.title}" אינו משובץ ליום כלשהו`;
    case "unsatisfied-recurrence":
        return `לאירוע המחזורי "${error.title}" אין שיבוץ פתיחה בשבוע הראשון`;
    }
}

export function PreviewValidationErrors({
    errors,
}: {
    errors: Array<CutValidationError>;
}) {
    return (
        <Stack gap={1} sx={{ p: 2 }}>
            <Alert severity="warning">
                לא ניתן להציג תצוגה מקדימה — נמצאו בעיות בתוכנית:
            </Alert>
            <List dense disablePadding>
                {errors.map((error) => (
                    <ListItem
                        disableGutters
                        key={
                            "eventId" in error
                                ? `${error.type}:${error.eventId}`
                                : error.type
                        }
                    >
                        <ListItemText primary={describeValidationError(error)} />
                    </ListItem>
                ))}
            </List>
        </Stack>
    );
}

export function PreviewLoading() {
    return (
        <Box
            alignItems="center"
            display="flex"
            height="100%"
            justifyContent="center"
            width="100%"
        >
            <CircularProgress size={28} />
        </Box>
    );
}

/**
 * Read-only week timetable of the cut plan ("תצוגה מקדימה") — how each week
 * would look on the schedule, rendered with the same calendar engine and
 * toolbar feel as the schedule page, without writing anything.
 */
export function CutPreviewTab({ curriculumId }: CutPreviewTabProps) {
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const { getCustomColor } = useCustomColors();
    const preview = useCutPreview(curriculumId);
    const [view, setView] = useState<View>("week");
    const [date, setDate] = useState<Date | null>(null);

    const events = useMemo<Array<PreviewCalendarEvent>>(() => {
        if (preview.kind !== "ready" || !preview.data.ok) return [];
        return preview.data.occurrences.map((occ) => ({
            title: occ.title,
            start: new Date(occ.startTime),
            end: new Date(occ.endTime),
            resource: occ,
        }));
    }, [preview]);

    const firstEventDate = useMemo(
        () =>
            events.length > 0
                ? events.reduce(
                    (min, e) => (e.start < min ? e.start : min),
                    events[0].start,
                )
                : new Date(),
        [events],
    );
    const shownDate = date ?? firstEventDate;

    const navigate = useCallback(
        (direction: "next" | "prev" | "start") => {
            if (direction === "start") {
                setDate(null);
                return;
            }
            const step = view === "day" ? 1 : 7;
            const delta = direction === "next" ? step : -step;
            setDate(dayjs(shownDate).add(delta, "day").toDate());
        },
        [shownDate, view],
    );

    const eventPropGetter = useCallback(
        (event: PreviewCalendarEvent) => {
            // Type palette is only the fallback for non-Hive events; Hive-linked
            // events resolve to their real subject color via the same path the
            // actual schedule uses, so the preview matches the calendar (#331).
            const COLOR_BY_TYPE: Record<ModuleEventType, string> = {
                [ModuleEventType.Lecture]: theme.palette.primary.main,
                [ModuleEventType.Exercise]: theme.palette.secondary.main,
                [ModuleEventType.SelfTeaching]: theme.palette.success.main,
                [ModuleEventType.Other]: theme.palette.grey[600],
            };
            const typeFallback =
                COLOR_BY_TYPE[event.resource.eventType] ??
                theme.palette.grey[600];
            const { hiveSubjectId } = event.resource;
            const subject =
                hiveSubjectId != null ? getSubject(hiveSubjectId) : undefined;
            const backgroundColor = resolveEventColor(
                {},
                subject,
                { getCustomColor, getSubject },
                typeFallback,
            );
            return {
                style: {
                    backgroundColor,
                    opacity: event.resource.isRecurrenceEcho ? 0.65 : 1,
                    borderRadius: "6px",
                    border: "none",
                },
            };
        },
        [theme, getSubject, getCustomColor],
    );

    if (preview.kind === "loading") return <PreviewLoading />;
    if (preview.kind === "error") {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {preview.message}
            </Alert>
        );
    }
    if (!preview.data.ok) {
        return <PreviewValidationErrors errors={preview.data.errors} />;
    }

    const weekLabel = dayjs(shownDate).format("DD/MM/YYYY");

    return (
        <Box display="flex" flexDirection="column" height="100%" minHeight={0}>
            <Box
                alignItems="center"
                display="flex"
                flexWrap="wrap"
                gap={1.5}
                justifyContent="space-between"
                pb={1}
            >
                <ButtonGroup
                    size="small"
                    sx={{ "& .MuiButton-root": { height: 32 } }}
                    variant="outlined"
                >
                    <Button onClick={() => navigate("prev")}>
                        {CALENDAR_MESSAGES.previous}
                    </Button>
                    <Button onClick={() => navigate("start")}>
                        תחילת הגאנט
                    </Button>
                    <Button onClick={() => navigate("next")}>
                        {CALENDAR_MESSAGES.next}
                    </Button>
                </ButtonGroup>
                <Typography fontWeight="bold" variant="subtitle1">
                    שבוע {weekLabel}
                </Typography>
                <Stack alignItems="center" direction="row" gap={1.5}>
                    {preview.data.skipped.length > 0 ? (
                        <Alert
                            severity="warning"
                            sx={{ py: 0, "& .MuiAlert-message": { py: 0.5 } }}
                        >
                            {preview.data.skipped.length} אירועים לא משובצים
                            הושמטו מהתצוגה
                        </Alert>
                    ) : null}
                    {preview.data.overlaps > 0 ? (
                        <Alert
                            severity="info"
                            sx={{ py: 0, "& .MuiAlert-message": { py: 0.5 } }}
                        >
                            {preview.data.overlaps} חפיפות בתוכנית
                        </Alert>
                    ) : null}
                    <ButtonGroup
                        size="small"
                        sx={{ "& .MuiButton-root": { height: 32 } }}
                        variant="outlined"
                    >
                        <Button
                            onClick={() => setView("day")}
                            variant={view === "day" ? "contained" : "outlined"}
                        >
                            {CALENDAR_MESSAGES.day}
                        </Button>
                        <Button
                            onClick={() => setView("week")}
                            variant={view === "week" ? "contained" : "outlined"}
                        >
                            {CALENDAR_MESSAGES.week}
                        </Button>
                    </ButtonGroup>
                </Stack>
            </Box>
            <Box flexGrow={1} minHeight={0}>
                <Calendar<PreviewCalendarEvent>
                    date={shownDate}
                    endAccessor="end"
                    eventPropGetter={eventPropGetter}
                    events={events}
                    localizer={localizer}
                    messages={
                        CALENDAR_MESSAGES as unknown as Messages<PreviewCalendarEvent>
                    }
                    onNavigate={(newDate) => setDate(newDate)}
                    onView={setView}
                    rtl
                    startAccessor="start"
                    toolbar={false}
                    view={view}
                    views={["day", "week"]}
                />
            </Box>
        </Box>
    );
}
