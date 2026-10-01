import { DragOverlay, useDndContext, useDraggable } from "@dnd-kit/core";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";

export type GanttUnallocatedGroup = {
    syllabusId: string;
    syllabusTitle: string;
    modules: Array<{ id: string; title: string }>;
    events: Array<{ id: string; title: string; moduleId: string }>;
};

export type GanttUnallocatedPanelProps = {
    unallocatedBySyllabus: Array<GanttUnallocatedGroup>;
    onReveal: (syllabusId: string, moduleId: string, eventId?: string) => void;
};

type UnallocatedChipProps = {
    id: string;
    label: string;
    // dnd payload: the same `module-map` / `event-map` the timeline blocks
    // carry, so GanttView's drag handler places it with no new branch.
    payload: { type: "event-map"; moduleId: string; eventId: string }
        | { type: "module-map"; moduleId: string };
    color?: "primary";
    onClick: () => void;
};

const UnallocatedChip: React.FC<UnallocatedChipProps> = ({
    id,
    label,
    payload,
    color,
    onClick,
}) =>
{
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id,
        data: { ...payload, unallocatedLabel: label },
    });

    return (
        <Chip
            clickable
            color={ color }
            label={ label }
            onClick={ onClick }
            ref={ setNodeRef }
            size="small"
            sx={ { cursor: "grab", opacity: isDragging ? 0.4 : 1, touchAction: "none" } }
            variant="outlined"
            { ...listeners }
            { ...attributes }
        />
    );
};

// Floats the dragged chip above the panel's scroll container, which would
// otherwise clip the in-place transform.
const UnallocatedDragOverlay: React.FC = () =>
{
    const { active } = useDndContext();
    const label = active?.data.current?.unallocatedLabel as string | undefined;
    return (
        <DragOverlay dropAnimation={ null }>
            { label ? <Chip label={ label } size="small" /> : null }
        </DragOverlay>
    );
};

export const GanttUnallocatedPanel: React.FC<GanttUnallocatedPanelProps> = ({
    unallocatedBySyllabus,
    onReveal,
}) =>
{
    const theme = useTheme();

    return (
        <Box
            sx={ {
                px: 2,
                py: 1.5,
                borderBottom: `1px solid ${theme.vars.palette.divider}`,
                backgroundColor:
                    theme.vars.palette.background.paper,
                flexShrink: 0,
                maxHeight: 200,
                overflow: "auto",
            } }
        >
            { unallocatedBySyllabus.length === 0 ? (
                <Typography
                    color="text.secondary"
                    variant="body2"
                >
                    כל המערכים והמפגשים משובצים 🎉
                </Typography>
            ) : (
                <Stack spacing={ 1 }>
                    { unallocatedBySyllabus.map((group) => (
                        <Box key={ group.syllabusId }>
                            <Typography
                                fontWeight="bold"
                                variant="caption"
                            >
                                { group.syllabusTitle }
                            </Typography>
                            <Box
                                sx={ {
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.5,
                                    mt: 0.5,
                                } }
                            >
                                { group.modules.map((m) => (
                                    <UnallocatedChip
                                        color="primary"
                                        id={ `drag-module-unallocated-${m.id}` }
                                        key={ m.id }
                                        label={ m.title }
                                        onClick={ () =>
                                            onReveal(
                                                group.syllabusId,
                                                m.id,
                                            )
                                        }
                                        payload={ { type: "module-map", moduleId: m.id } }
                                    />
                                )) }
                                { group.events.map((e) => (
                                    <UnallocatedChip
                                        id={ `drag-event-unallocated-${e.id}` }
                                        key={ e.id }
                                        label={ e.title }
                                        onClick={ () =>
                                            onReveal(
                                                group.syllabusId,
                                                e.moduleId,
                                                e.id,
                                            )
                                        }
                                        payload={ {
                                            type: "event-map",
                                            moduleId: e.moduleId,
                                            eventId: e.id,
                                        } }
                                    />
                                )) }
                            </Box>
                        </Box>
                    )) }
                </Stack>
            ) }
            <UnallocatedDragOverlay />
        </Box>
    );
};
