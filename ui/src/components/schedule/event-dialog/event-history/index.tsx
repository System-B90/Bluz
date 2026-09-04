"use client";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import RefreshIcon from "@mui/icons-material/Refresh";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useRef, useState } from "react";

import { apiGetEventHistory } from "@/api-client/calendar";
import { ApiEventHistoryEntry } from "@/api-shared/types/event-history";
import { useCourses } from "@/components/base/CoursesProvider";
import { useCustomColors } from "@/components/base/CustomColorsProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { useRooms } from "@/components/base/RoomsProvider";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { resolveColorById } from "@/components/schedule/event-component/event-colors";
import { EventHistoryTimeline } from "@/components/schedule/event-dialog/event-history/EventHistoryTimeline";
import { ChangeValueLookups } from "@/components/schedule/event-dialog/event-history/format-change";
import { EventId } from "@/components/schedule/types/event";

/**
 * "היסטוריית שינויים" — the audit trail of one schedule event, rendered inside
 * the event dialog. Collapsed by default (the dialog is an editing surface
 * first) and loaded lazily on first expand, so opening a dialog costs nothing
 * extra until the user asks for the history.
 */

export type EventHistoryPanelProps = {
    eventId: EventId;
};

function LoadingRows() {
    return (
        <Stack gap={2} sx={{ py: 1 }}>
            {[0, 1, 2].map((row) => (
                <Stack direction="row" gap={1.5} key={row}>
                    <Skeleton height={32} variant="circular" width={32} />
                    <Stack gap={0.5} sx={{ flexGrow: 1 }}>
                        <Skeleton height={18} variant="text" width="35%" />
                        <Skeleton height={14} variant="text" width="55%" />
                    </Stack>
                </Stack>
            ))}
        </Stack>
    );
}

export function EventHistoryPanel({ eventId }: EventHistoryPanelProps) {
    const { iterationId } = useCalendar();
    const { getInstructor } = useHiveUsers();
    const { courses } = useCourses();
    const { rooms } = useRooms();
    const { getCustomColor } = useCustomColors();
    const { getSubject } = useHiveSubjects();

    const [expanded, setExpanded] = useState(false);
    const [entries, setEntries] = useState<Array<ApiEventHistoryEntry> | null>(
        null,
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<null | string>(null);

    // Only the newest request may write state (#618). The dialog is reused
    // across events, so an in-flight fetch for event A can otherwise resolve
    // after the switch to event B and show A's audit trail under B. Double
    // -clicking refresh has the same hazard.
    const requestSequence = useRef(0);

    const load = useCallback(async () => {
        const sequence = ++requestSequence.current;
        setLoading(true);
        setError(null);
        try {
            const fetched = await apiGetEventHistory(eventId, iterationId);
            if (sequence !== requestSequence.current) return;
            setEntries(fetched);
        } catch {
            if (sequence !== requestSequence.current) return;
            setError("טעינת היסטוריית השינויים נכשלה.");
        } finally {
            if (sequence === requestSequence.current) setLoading(false);
        }
    }, [eventId, iterationId]);

    // The dialog is reused across events, so a different event must not show
    // the previous one's log. Reset while rendering (React's "adjust state on
    // prop change" pattern) and collapse: the panel is lazy by design, and the
    // next expand fetches the right event.
    const [loggedEventId, setLoggedEventId] = useState(eventId);
    if (eventId !== loggedEventId) {
        setLoggedEventId(eventId);
        setEntries(null);
        setError(null);
        setExpanded(false);
    }

    // Lazy: nothing is fetched until the user asks for the history.
    const handleExpandChange = useCallback(
        (_event: unknown, isExpanded: boolean) => {
            setExpanded(isExpanded);
            if (isExpanded) void load();
        },
        [load],
    );

    const lookups = useMemo<ChangeValueLookups>(
        () => ({
            colorInfo: (id) =>
                resolveColorById(id, { getCustomColor, getSubject }),
            courseName: (id) => courses.find((course) => course.id === id)?.name,
            instructorName: (id) => getInstructor(id)?.display_name,
            roomName: (id) => rooms.find((room) => room.id === id)?.name,
        }),
        [courses, getCustomColor, getInstructor, getSubject, rooms],
    );

    return (
        <Accordion
            disableGutters
            elevation={0}
            expanded={expanded}
            onChange={handleExpandChange}
            sx={{
                "&::before": { display: "none" },
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                overflow: "hidden",
            }}
        >
            <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                    "& .MuiAccordionSummary-content": {
                        alignItems: "center",
                        gap: 1,
                        my: 1,
                    },
                    "&:hover": { bgcolor: "action.hover" },
                    transition: (theme) =>
                        theme.transitions.create("background-color", {
                            duration: theme.transitions.duration.shorter,
                        }),
                }}
            >
                <HistoryIcon fontSize="small" sx={{ color: "text.secondary" }} />
                <Typography sx={{ fontWeight: 600 }} variant="subtitle2">
                    היסטוריית שינויים
                </Typography>
                {entries === null ? null : (
                    <Chip
                        label={entries.length}
                        size="small"
                        sx={{ height: 20 }}
                        variant="outlined"
                    />
                )}
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 0 }}>
                <Stack gap={1} sx={{ minWidth: 0 }}>
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                    >
                        <Typography
                            sx={{ color: "text.secondary" }}
                            variant="caption"
                        >
                            כל שינוי שנרשם למופע זה, מהחדש לישן.
                        </Typography>
                        <Tooltip title="רענון">
                            <span>
                                <IconButton
                                    disabled={loading}
                                    onClick={() => void load()}
                                    size="small"
                                >
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>

                    {loading ? <LoadingRows /> : null}

                    {!loading && error ? (
                        <Alert
                            action={
                                <Button
                                    color="inherit"
                                    onClick={() => void load()}
                                    size="small"
                                >
                                    נסו שוב
                                </Button>
                            }
                            severity="error"
                            variant="outlined"
                        >
                            {error}
                        </Alert>
                    ) : null}

                    {!loading && !error && entries?.length === 0 ? (
                        <Alert severity="info" variant="outlined">
                            לא נרשמו שינויים למופע זה.
                        </Alert>
                    ) : null}

                    {!loading && !error && entries && entries.length > 0 ? (
                        <EventHistoryTimeline
                            entries={entries}
                            lookups={lookups}
                        />
                    ) : null}
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}
