"use client";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import GroupsIcon from "@mui/icons-material/Groups";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";

import { CourseUser } from "@/api-shared/types/hive";
import { useGroupedInstructors } from "@/components/base/use-grouped-instructors";
import { HiveAvatar } from "@/components/header/HiveAvatarImage";
import { useInstructorDnd } from "@/components/schedule/calendar/instructor-dnd/InstructorDndProvider";
import {
    paletteDraggableId,
    UNASSIGN_DROPPABLE_ID,
} from "@/components/schedule/calendar/instructor-dnd/types";

const RAIL_WIDTH = 168;
const RAIL_COLLAPSED_WIDTH = 40;

function InstructorRailChip({
    instructor,
    groupKey,
}: {
    instructor: CourseUser;
    groupKey: string;
}) {
    // An instructor can belong to several courses, so the draggable id is
    // qualified by group to stay unique across the rail.
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: paletteDraggableId(instructor.id, groupKey),
        data: { kind: "palette-instructor", personId: instructor.id },
    });

    return (
        <Box
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            sx={{
                px: 0.75,
                py: 0.4,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                fontSize: "0.78rem",
                cursor: "grab",
                touchAction: "none",
                opacity: isDragging ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                overflow: "hidden",
                transition: "background-color 0.15s ease-in-out",
                "&:hover": { bgcolor: "action.hover" },
            }}
            title={instructor.display_name}
        >
            <HiveAvatar
                alt={instructor.display_name}
                hiveId={instructor.id}
                sx={{ width: 22, height: 22, fontSize: "0.7rem" }}
            />
            <Box
                component="span"
                sx={{
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {instructor.display_name}
            </Box>
        </Box>
    );
}

function UnassignDropZone() {
    const { activeDrag } = useInstructorDnd();
    const { setNodeRef, isOver } = useDroppable({ id: UNASSIGN_DROPPABLE_ID });
    const armed = activeDrag?.kind === "event-person";

    return (
        <Box
            ref={setNodeRef}
            sx={{
                mt: 1,
                p: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                borderRadius: 1,
                border: "1px dashed",
                borderColor: isOver && armed ? "error.main" : "divider",
                color: isOver && armed ? "error.main" : "text.disabled",
                bgcolor: isOver && armed ? "error.light" : "transparent",
                opacity: armed ? 1 : 0.45,
                transition: "all 0.15s ease-in-out",
            }}
        >
            <DeleteOutlineIcon fontSize="small" />
            <Typography variant="caption">הסרה</Typography>
        </Box>
    );
}

/**
 * Collapsible side rail listing every instructor as a drag source for the
 * schedule calendar, plus the drop zone that unassigns a dragged person chip.
 *
 * @returns The rendered rail element.
 */
export function InstructorRail() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const { courseGroups, unassigned } = useGroupedInstructors({
        searchQuery: query,
    });

    const groups = useMemo(
        () => [
            ...courseGroups.map(({ course, instructors }) => ({
                key: course.id,
                title: course.name,
                instructors,
            })),
            ...(unassigned.length > 0
                ? [
                    {
                        key: "unassigned",
                        title: "ללא מסלול",
                        instructors: unassigned,
                    },
                ]
                : []),
        ],
        [courseGroups, unassigned],
    );

    return (
        <Box
            sx={{
                // The rail slides like a drawer: the flex track animates its
                // own width while the panel inside keeps a fixed width, so the
                // content never reflows mid-transition.
                width: open ? RAIL_WIDTH : RAIL_COLLAPSED_WIDTH,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                borderInlineStart: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
                transition: (theme) =>
                    theme.transitions.create("width", {
                        easing: theme.transitions.easing.easeInOut,
                        duration: theme.transitions.duration.standard,
                    }),
                "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                },
            }}
        >
            <Box
                sx={{
                    // Fixed width regardless of state — the track above clips
                    // it, which is what makes the motion read as a slide rather
                    // than a squeeze.
                    width: RAIL_WIDTH,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    py: 1,
                    // The rail hugs the physical screen edge, which is the
                    // inline-end side under RTL — give that side the breathing
                    // room and keep the calendar-facing side tight.
                    paddingInlineStart: 0.5,
                    paddingInlineEnd: 1.5,
                    boxSizing: "border-box",
                    overflow: "hidden",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexDirection: open ? "row" : "row-reverse",
                        gap: 0.5,
                        flexShrink: 0,
                    }}
                >
                    <Typography
                        sx={{
                            fontWeight: 600,
                            opacity: open ? 1 : 0,
                            transition: "opacity 0.15s ease-in-out",
                        }}
                        variant="caption"
                    >
                        מבוזרים
                    </Typography>
                    <Tooltip
                        title={
                            open
                                ? "סגירת רשימת מבוזרים"
                                : "פתיחת רשימת מבוזרים"
                        }
                    >
                        <IconButton
                            onClick={() => setOpen((prev) => !prev)}
                            size="small"
                        >
                            {open ? (
                                <ChevronLeftIcon fontSize="small" />
                            ) : (
                                <GroupsIcon fontSize="small" />
                            )}
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Kept mounted so the search text and scroll position survive
                    a collapse; hidden from pointer and a11y trees while shut. */}
                <Box
                    aria-hidden={!open}
                    inert={!open}
                    sx={{
                        flexGrow: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        opacity: open ? 1 : 0,
                        pointerEvents: open ? "auto" : "none",
                        transition: (theme) =>
                            theme.transitions.create("opacity", {
                                duration: theme.transitions.duration.shorter,
                            }),
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                        },
                    }}
                >
                    <InputBase
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="חיפוש"
                        sx={{
                            my: 0.75,
                            px: 1,
                            py: 0.25,
                            fontSize: "0.78rem",
                            borderRadius: 1,
                            border: "1px solid",
                            borderColor: "divider",
                            flexShrink: 0,
                        }}
                        value={query}
                    />

                    <Typography
                        color="text.secondary"
                        sx={{ mb: 0.5, fontSize: "0.65rem", flexShrink: 0 }}
                    >
                        גרירה לאירוע = שיבוץ. Shift = מרצים.
                    </Typography>

                    <Box
                        sx={{
                            flexGrow: 1,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.5,
                        }}
                    >
                        {groups.map((group) => (
                            <Box
                                key={group.key}
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.5,
                                }}
                            >
                                <Typography
                                    color="text.secondary"
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: "0.68rem",
                                        position: "sticky",
                                        top: 0,
                                        bgcolor: "background.paper",
                                        zIndex: 1,
                                    }}
                                >
                                    {group.title}
                                </Typography>
                                {group.instructors.map((instructor) => (
                                    <InstructorRailChip
                                        groupKey={group.key}
                                        instructor={instructor}
                                        key={`${group.key}-${instructor.id}`}
                                    />
                                ))}
                            </Box>
                        ))}
                    </Box>

                    <UnassignDropZone />
                </Box>
            </Box>
        </Box>
    );
}
