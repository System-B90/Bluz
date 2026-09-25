import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
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

/** Sortable id for a group's header row; never collides with event ids. */
export const groupSortableId = (groupId: string) => `group:${groupId}`;

export function ModuleEventGroupRow({
    moduleId,
    groupId,
    eventIds,
    expanded,
    onToggle,
    highlightedEventId,
}: {
    moduleId: GanttModuleId;
    groupId: string;
    eventIds: Array<GanttEventId>;
    expanded: boolean;
    onToggle: () => void;
    highlightedEventId: GanttEventId | null;
}) {
    const state = useCurriculumState();
    const { getInstructor } = useHiveUsers();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: groupSortableId(groupId) });
    // Header and members rows move together while dragging.
    const dragStyle = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

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

    const syllabusId = state.modules[moduleId]?.syllabusId;
    const shuffleDescriptions = syllabusId
        ? state.syllabuses[syllabusId]?.shuffleDescriptions
        : undefined;

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
            <TableRow ref={setNodeRef} style={dragStyle}>
                <TableCell sx={{ width: "1rem", pr: 0, cursor: "grab" }} {...attributes} {...listeners}>
                    <DragIndicatorIcon fontSize="small" sx={{ color: "text.disabled", display: "block" }} />
                </TableCell>
                <TableCell>
                    <Stack alignItems="center" direction="row" flexWrap="wrap" gap={0.5}>
                        <IconButton
                            aria-label={expanded ? "כיווץ הקבוצה" : "הרחבת הקבוצה"}
                            onClick={onToggle}
                            size="small"
                            sx={{ p: 0 }}
                        >
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
                        <Typography
                            onClick={onToggle}
                            sx={{ cursor: "pointer", fontWeight: 500, marginInlineEnd: 0.5 }}
                            variant="body2"
                        >
                            {firstMember?.title ?? ""}
                        </Typography>
                        <Chip label={`×${members.length}`} size="small" variant="outlined" />
                        <ShuffleChips
                            descriptions={shuffleDescriptions}
                            shuffles={members.flatMap((event) => event?.shuffles ?? [])}
                        />
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
            <TableRow style={dragStyle}>
                <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Table size="small">
                            <TableBody>
                                <SortableContext items={eventIds} strategy={verticalListSortingStrategy}>
                                    {eventIds.map((eventId) => (
                                        <ModuleEventView
                                            eventId={eventId}
                                            isHighlighted={eventId === highlightedEventId}
                                            key={eventId}
                                            moduleId={moduleId}
                                        />
                                    ))}
                                </SortableContext>
                            </TableBody>
                        </Table>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}
