import { DragOverlay, useDndContext, useDraggable } from "@dnd-kit/core";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React, { useCallback, useLayoutEffect, useRef, useState } from "react";

/** Never more than ~a fifth of the viewport, and never above the old 200px. */
export const UNALLOCATED_PANEL_MAX_HEIGHT = "min(200px, 22vh)";

export type GanttUnallocatedGroup = {
    syllabusId: string;
    syllabusTitle: string;
    modules: Array<{ id: string; title: string }>;
    events: Array<{ id: string; title: string; moduleId: string; moduleTitle: string }>;
};

export type GanttUnallocatedPanelProps = {
    unallocatedBySyllabus: Array<GanttUnallocatedGroup>;
    onReveal: (syllabusId: string, moduleId: string, eventId?: string) => void;
};

type UnallocatedKind = "event" | "module";

/**
 * Modules and events differ by icon and outline colour, never by colour
 * alone (#818). The drag overlay reuses this so the chip keeps its look.
 */
const KIND_STYLE: Record<UnallocatedKind, { color?: "primary"; icon: React.ReactElement }> = {
    module: { color: "primary", icon: <FolderOutlinedIcon /> },
    event: { icon: <EventOutlinedIcon /> },
};

type UnallocatedChipProps = {
    id: string;
    label: string;
    kind: UnallocatedKind;
    /** Hover text: the event's module path, so look-alike names are told apart. */
    tooltip?: string;
    // dnd payload: the same `module-map` / `event-map` the timeline blocks
    // carry, so GanttView's drag handler places it with no new branch.
    payload: { type: "event-map"; moduleId: string; eventId: string }
        | { type: "module-map"; moduleId: string };
    onClick: () => void;
};

const UnallocatedChip: React.FC<UnallocatedChipProps> = ({
    id,
    label,
    kind,
    tooltip,
    payload,
    onClick,
}) =>
{
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id,
        data: { ...payload, unallocatedLabel: label, unallocatedKind: kind },
    });

    const chip = (
        <Chip
            clickable
            color={ KIND_STYLE[ kind ].color }
            data-unallocated-chip={ kind }
            icon={ KIND_STYLE[ kind ].icon }
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

    return tooltip ? <Tooltip describeChild title={ tooltip }>{ chip }</Tooltip> : chip;
};

// Floats the dragged chip above the panel's scroll container, which would
// otherwise clip the in-place transform.
const UnallocatedDragOverlay: React.FC = () =>
{
    const { active } = useDndContext();
    const label = active?.data.current?.unallocatedLabel as string | undefined;
    const kind = (active?.data.current?.unallocatedKind ?? "event") as UnallocatedKind;
    return (
        <DragOverlay dropAnimation={ null }>
            { label ? (
                <Chip
                    color={ KIND_STYLE[ kind ].color }
                    icon={ KIND_STYLE[ kind ].icon }
                    label={ label }
                    size="small"
                    sx={ { backgroundColor: "background.paper" } }
                    variant="outlined"
                />
            ) : null }
        </DragOverlay>
    );
};

/** Chips whose box ends below the scroll container's visible bottom. */
export function countHiddenBelow(container: HTMLElement): number
{
    const bottom = container.getBoundingClientRect().bottom;
    return Array.from(
        container.querySelectorAll<HTMLElement>("[data-unallocated-chip]"),
    ).filter((chip) => chip.getBoundingClientRect().bottom > bottom + 1).length;
}

const KindHeading: React.FC<{ children: string }> = ({ children }) => (
    <Typography
        color="text.secondary"
        component="div"
        sx={ { mt: 0.5 } }
        variant="caption"
    >
        { children }
    </Typography>
);

export const GanttUnallocatedPanel: React.FC<GanttUnallocatedPanelProps> = ({
    unallocatedBySyllabus,
    onReveal,
}) =>
{
    const theme = useTheme();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [ hiddenCount, setHiddenCount ] = useState(0);

    // The panel is capped and scrolls; say how much is still below the fold
    // so nothing is silently forgotten (#818).
    const measureHidden = useCallback(() =>
    {
        if (scrollRef.current) setHiddenCount(countHiddenBelow(scrollRef.current));
    }, []);

    useLayoutEffect(() =>
    {
        measureHidden();
        const node = scrollRef.current;
        if (!node || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measureHidden);
        observer.observe(node);
        return () => observer.disconnect();
    }, [ measureHidden, unallocatedBySyllabus ]);

    return (
        <Box
            sx={ {
                position: "relative",
                borderBottom: `1px solid ${theme.vars.palette.divider}`,
                backgroundColor:
                    theme.vars.palette.background.paper,
                flexShrink: 0,
            } }
        >
            <Box
                data-testid="unallocated-panel-scroll"
                onScroll={ measureHidden }
                ref={ scrollRef }
                sx={ {
                    px: 2,
                    py: 1.5,
                    // Viewport-relative so a ~735px laptop screen keeps most of the
                    // timeline in view; the user can drag it taller (#819).
                    maxHeight: UNALLOCATED_PANEL_MAX_HEIGHT,
                    resize: "vertical",
                    overflow: "auto",
                } }
            >
                { unallocatedBySyllabus.length === 0 ? (
                    <Typography
                        color="text.secondary"
                        variant="body2"
                    >
                        כל המערכים והמופעים משובצים 🎉
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
                                { group.modules.length > 0 ? (
                                    <>
                                        <KindHeading>מערכים</KindHeading>
                                        <Box sx={ { display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.25 } }>
                                            { group.modules.map((m) => (
                                                <UnallocatedChip
                                                    id={ `drag-module-unallocated-${m.id}` }
                                                    key={ m.id }
                                                    kind="module"
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
                                        </Box>
                                    </>
                                ) : null }
                                { group.events.length > 0 ? (
                                    <>
                                        <KindHeading>מופעים</KindHeading>
                                        <Box sx={ { display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.25 } }>
                                            { group.events.map((e) => (
                                                <UnallocatedChip
                                                    id={ `drag-event-unallocated-${e.id}` }
                                                    key={ e.id }
                                                    kind="event"
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
                                                    tooltip={ `${e.moduleTitle} › ${e.title}` }
                                                />
                                            )) }
                                        </Box>
                                    </>
                                ) : null }
                            </Box>
                        )) }
                    </Stack>
                ) }
            </Box>
            { hiddenCount > 0 ? (
                <Box
                    aria-live="polite"
                    data-testid="unallocated-more"
                    sx={ {
                        position: "absolute",
                        insetInline: 0,
                        bottom: 0,
                        height: 32,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        pb: 0.25,
                        pointerEvents: "none",
                        background: `linear-gradient(to bottom, transparent, ${theme.vars.palette.background.paper} 70%)`,
                    } }
                >
                    <Typography color="text.secondary" variant="caption">
                        { `ועוד ${hiddenCount} ↓` }
                    </Typography>
                </Box>
            ) : null }
            <UnallocatedDragOverlay />
        </Box>
    );
};
