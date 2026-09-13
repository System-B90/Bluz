import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import RestoreIcon from "@mui/icons-material/Restore";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import {
    GanttEventExecution,
    OccurrenceExecution,
} from "@/api-shared/types/gantt/execution";
import { EventRecurrence, GanttEvent } from "@/api-shared/types/gantt/models";
import { formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { CollapsibleSection } from "@/components/gantt/event-dialog/CollapsibleSection";
import { useGanttExecution } from "@/components/gantt/state/execution/hooks";

const DATE_FORMAT = "DD/MM/YYYY";

/**
 * What the user actually cares about per occurrence: did the event happen on
 * its planned day, and did the duration change.
 */
function OccurrenceRow({
    ganttEventId,
    occurrence,
}: {
    ganttEventId: string;
    occurrence: OccurrenceExecution;
}) {
    const { recreateOccurrence } = useGanttExecution();
    const [isRecreating, setIsRecreating] = useState(false);
    // The plan may have moved on since the deletion (the gantt was edited
    // after the cut) — only offer the button while there is still a planned
    // occurrence to recreate from.
    const canRecreate = !occurrence.actual && Boolean(occurrence.planned);

    const handleRecreate = async () => {
        setIsRecreating(true);
        try {
            await recreateOccurrence(ganttEventId, occurrence.occurrenceDate);
        } finally {
            setIsRecreating(false);
        }
    };

    return (
        <TableRow
            sx={
                occurrence.drifted
                    ? {
                        backgroundColor: (theme) =>
                            `rgba(${theme.vars.palette.warning.mainChannel} / 0.12)`,
                    }
                    : undefined
            }
        >
            <TableCell>
                {dayjs(occurrence.occurrenceDate).format(DATE_FORMAT)}
            </TableCell>
            <TableCell>
                {occurrence.actual ? (
                    dayjs(occurrence.actual.startTime).format(DATE_FORMAT)
                ) : (
                    <Chip
                        color="error"
                        label="נמחק"
                        size="small"
                        variant="outlined"
                    />
                )}
            </TableCell>
            <TableCell>
                {occurrence.planned
                    ? formatHoursLabel(occurrence.planned.durationMinutes)
                    : "—"}
            </TableCell>
            <TableCell>
                {occurrence.actual
                    ? formatHoursLabel(occurrence.actual.durationMinutes)
                    : "—"}
            </TableCell>
            <TableCell>
                {canRecreate ? (
                    <Tooltip title="שחזור האירוע ללו&quot;ז">
                        <span>
                            <IconButton
                                disabled={isRecreating}
                                onClick={handleRecreate}
                                size="small"
                            >
                                <RestoreIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                ) : null}
            </TableCell>
        </TableRow>
    );
}

function ExecutionTable({
    execution,
    isRecurring,
}: {
    execution: GanttEventExecution;
    isRecurring: boolean;
}) {
    return (
        <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>תאריך מתוכנן</TableCell>
                        <TableCell>בוצע בתאריך</TableCell>
                        <TableCell>משך מתוכנן</TableCell>
                        <TableCell>משך בפועל</TableCell>
                        <TableCell />
                    </TableRow>
                </TableHead>
                <TableBody>
                    {execution.occurrences.map((occurrence) => (
                        <OccurrenceRow
                            ganttEventId={execution.ganttEventId}
                            key={`${occurrence.occurrenceDate}-${occurrence.actual?.eventId ?? "planned"}`}
                            occurrence={occurrence}
                        />
                    ))}
                    {isRecurring ? <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>
                            סה&quot;כ
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                            {execution.totals.occurrencesActual} מתוך{" "}
                            {execution.totals.occurrencesPlanned} מופעים
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                            {formatHoursLabel(execution.totals.plannedMinutes)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                            {formatHoursLabel(execution.totals.actualMinutes)}
                        </TableCell>
                        <TableCell />
                    </TableRow> : null}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

/**
 * תכנון מול ביצוע (#121): per-occurrence comparison between this gantt
 * event's plan and the schedule events that were cut from it. Refreshes on
 * mount (i.e. every dialog open) so the comparison is current.
 */
export function ExecutionComparisonSection({ event }: { event: GanttEvent }) {
    const { state, refreshExecution } = useGanttExecution();

    useEffect(() => {
        void refreshExecution();
    }, [refreshExecution]);

    const execution = state.events[event.id];
    const isRecurring = event.recurrence !== EventRecurrence.None;

    return (
        <CollapsibleSection
            chips={
                execution ? (
                    <Chip
                        color={execution.drifted ? "warning" : "success"}
                        label={
                            execution.drifted ? "ביצוע שונה מהתכנון" : "כמתוכנן"
                        }
                        size="small"
                        variant="outlined"
                    />
                ) : (
                    <Chip
                        label="לא נגזר"
                        size="small"
                        sx={{ color: "text.secondary" }}
                        variant="outlined"
                    />
                )
            }
            icon={<CompareArrowsIcon />}
            title="תכנון מול ביצוע"
        >
            {execution ? (
                <ExecutionTable execution={execution} isRecurring={isRecurring} />
            ) : (
                <Typography color="text.secondary" variant="body2">
                    הלו&quot;ז טרם נגזר מתוכנית זו
                </Typography>
            )}
        </CollapsibleSection>
    );
}
