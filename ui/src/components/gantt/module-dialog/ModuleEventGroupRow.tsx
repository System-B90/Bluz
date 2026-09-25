import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonIcon from "@mui/icons-material/Person";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { ModuleEventView, ShuffleChips } from "@/components/gantt/module-dialog/ModuleEventView";
import { useCurriculumState } from "@/components/gantt/state/context";

export function ModuleEventGroupRow({
    moduleId,
    eventIds,
    expanded,
    onToggle,
    highlightedEventId,
}: {
    moduleId: GanttModuleId;
    eventIds: Array<GanttEventId>;
    expanded: boolean;
    onToggle: () => void;
    highlightedEventId: GanttEventId | null;
}) {
    const state = useCurriculumState();
    const { getInstructor } = useHiveUsers();

    const members = useMemo(
        () => eventIds.map((eventId) => state.events[eventId]).filter(Boolean),
        [eventIds, state.events],
    );

    const orchestratorIds = useMemo(
        () =>
            Array.from(
                new Set(
                    members
                        .map((event) => event?.orchestratorId)
                        .filter((id): id is number => id != null),
                ),
            ),
        [members],
    );

    const firstMember = members[0];
    const durations = members.map((event) => event?.minimumDuration ?? 0);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const durationLabel =
        minDuration === maxDuration
            ? `${minDuration}`
            : `${minDuration}–${maxDuration}`;

    return (
        <>
            <TableRow
                onClick={onToggle}
                sx={{
                    cursor: "pointer",
                    "& .MuiTableCell-root": { bgcolor: "action.hover" },
                }}
            >
                <TableCell sx={{ width: "1rem", pr: 0 }}>
                    <IconButton size="small">
                        <ExpandMoreIcon
                            fontSize="small"
                            sx={{
                                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                                transition: (theme) =>
                                    theme.transitions.create("transform", {
                                        duration: theme.transitions.duration.shortest,
                                    }),
                            }}
                        />
                    </IconButton>
                </TableCell>
                <TableCell>
                    <Stack alignItems="center" direction="row" flexWrap="wrap" gap={0.5}>
                        <Typography sx={{ fontWeight: 700, marginInlineEnd: 0.5 }} variant="body2">
                            {firstMember?.title ?? ""}
                        </Typography>
                        <ShuffleChips shuffles={members.flatMap((event) => event?.shuffles ?? [])} />
                    </Stack>
                </TableCell>
                <TableCell>
                    <Typography variant="body2">{firstMember?.type ?? ""}</Typography>
                </TableCell>
                <TableCell>
                    <Typography variant="body2">{durationLabel}</Typography>
                </TableCell>
                <TableCell>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {orchestratorIds.length > 0 ? (
                            orchestratorIds.map((id) => (
                                <Chip
                                    icon={<PersonIcon />}
                                    key={id}
                                    label={getInstructor(id)?.display_name ?? String(id)}
                                    size="small"
                                    variant="outlined"
                                />
                            ))
                        ) : (
                            <Typography color="text.disabled" variant="body2">
                                ללא אחראי
                            </Typography>
                        )}
                    </Stack>
                </TableCell>
                <TableCell />
            </TableRow>
            <TableRow>
                <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Table size="small">
                            <TableBody>
                                {eventIds.map((eventId) => (
                                    <ModuleEventView
                                        eventId={eventId}
                                        isHighlighted={eventId === highlightedEventId}
                                        key={eventId}
                                        moduleId={moduleId}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}
