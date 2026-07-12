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
import { CollapsibleSection } from "@/components/gantt/event-dialog/CollapsibleSection";
import { useGanttExecution } from "@/components/gantt/state/execution/hooks";

function formatTimeRange(startTime: string, endTime: string): string {
    return `${dayjs(startTime).format("HH:mm")}–${dayjs(endTime).format("HH:mm")}`;
}

function formatInstructors(ids: Array<number>): string {
    return ids.length > 0 ? ids.join(", ") : "—";
}

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
                {dayjs(occurrence.occurrenceDate).format("DD/MM/YYYY")}
            </TableCell>
            <TableCell>
                {occurrence.planned
                    ? formatTimeRange(
                        occurrence.planned.startTime,
                        occurrence.planned.endTime,
                    )
                    : "—"}
            </TableCell>
            <TableCell>
                {occurrence.actual ? (
                    formatTimeRange(
                        occurrence.actual.startTime,
                        occurrence.actual.endTime,
                    )
                ) : (
                    <Chip color="error" label="נמחק" size="small" variant="outlined" />
                )}
            </TableCell>
            <TableCell>
                {occurrence.planned
                    ? formatInstructors(occurrence.planned.instructorIds)
                    : "—"}
            </TableCell>
            <TableCell>
                {occurrence.actual
                    ? formatInstructors(occurrence.actual.instructorIds)
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
                        <TableCell>שעות מתוכננות</TableCell>
                        <TableCell>שעות בפועל</TableCell>
                        <TableCell>סגל מתוכנן</TableCell>
                        <TableCell>סגל בפועל</TableCell>
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
                            {execution.totals.plannedMinutes} דק&#39;
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                            {execution.totals.actualMinutes} דק&#39;
                        </TableCell>
                        <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
                                מופעים: {execution.totals.occurrencesActual} מתוך{" "}
                            {execution.totals.occurrencesPlanned} מתוכננים
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
                            execution.drifted ? "בוצע שונה מהמתוכנן" : "כמתוכנן"
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
