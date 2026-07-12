import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useEffect } from "react";

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
function OccurrenceRow({ occurrence }: { occurrence: OccurrenceExecution }) {
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
                    <Chip color="error" label="נמחק" size="small" variant="outlined" />
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
                    </TableRow>
                </TableHead>
                <TableBody>
                    {execution.occurrences.map((occurrence) => (
                        <OccurrenceRow
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
