import assert from "assert";

import { useDraggable } from "@dnd-kit/core";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import Box, { BoxProps } from "@mui/material/Box";
import { ChipProps } from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import { useMemo } from "react";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { eventPersonDraggableId } from "@/components/schedule/calendar/instructor-dnd/types";
import { shortenInstructorName } from "@/components/schedule/event-component/NameUtils";
import { tagSx } from "@/components/schedule/event-component/parts/tag-sx";
import {
    Event,
    eventHasLecturers,
    getPresentInstructors,
    PersonId,
} from "@/components/schedule/types/event";

export function PersonChip({
    instructorId,
    personData,
    event,
}: {
    instructorId?: number;
    personData?: any;
    event: Event;
}) {
    const { getInstructor, instructors } = useHiveUsers();
    const instructor = useMemo(
        () => (instructorId ? getInstructor(instructorId) : personData),
        [instructorId, getInstructor, personData],
    );

    assert(
        !(instructorId !== undefined && personData !== undefined),
        "Either instructorId or personData, not both must be supplied!",
    );

    const isLecturer =
        eventHasLecturers(event.type) &&
        event.lecturers?.includes(instructorId ?? personData);

    const fullName: string =
        instructor?.display_name ?? personData ?? instructorId;
    const shortName = useMemo(
        () =>
            typeof fullName === "string"
                ? shortenInstructorName(
                    fullName,
                    instructors.map((x) => x.display_name),
                )
                : fullName,
        [fullName, instructors],
    );

    const personId: PersonId = instructorId ?? personData;
    // Dragging a chip out of an event is the unassign gesture. Pointer events
    // stop here so react-big-calendar's own DnD does not also start moving the
    // event under the cursor.
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: eventPersonDraggableId(event.id, personId),
        disabled: event.locked,
        data: { kind: "event-person", personId, eventId: event.id },
    });

    return (
        <Tooltip title={fullName}>
            <Box
                component="span"
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                onPointerDown={(e: React.PointerEvent) => {
                    e.stopPropagation();
                    listeners?.onPointerDown?.(e);
                }}
                sx={{
                    ...tagSx({ isLecturer: !!isLecturer }),
                    cursor: event.locked ? "inherit" : "grab",
                    touchAction: "none",
                    opacity: isDragging ? 0.4 : 1,
                }}
            >
                <Link
                    color="inherit"
                    draggable={false}
                    href="a"
                    underline="hover"
                >
                    {shortName}
                </Link>
            </Box>
        </Tooltip>
    );
}

export function InstructorsList({
    event,
    chipSize: _chipSize,
    showCaption = true,
    ...props
}: {
    event: Event;
    showCaption?: boolean;
    chipSize?: ChipProps["size"];
} & BoxProps) {
    const { showMisconfigurations } = useCalendarFilters();
    const presentInstructors = getPresentInstructors(event);

    if (presentInstructors.length === 0) {
        if (!showMisconfigurations) {
            return null;
        }
        return (
            <Tooltip title="אין מבוזרים">
                <Box
                    alignItems="center"
                    display="flex"
                    flexDirection="row"
                    gap={0.4}
                    {...props}
                >
                    <PersonOffIcon color="error" sx={{ fontSize: "1.1rem" }} />
                </Box>
            </Tooltip>
        );
    }

    return (
        <Box
            alignItems="center"
            display="flex"
            flexDirection="row"
            flexWrap="wrap"
            gap={0.4}
            {...props}
        >
            {showCaption ? (
                <Tooltip
                    title={event.instructors.length === 1 ? "מבוזר" : "מבוזרים"}
                >
                    <PersonOutlinedIcon
                        sx={{ fontSize: "0.85rem", opacity: 0.6 }}
                    />
                </Tooltip>
            ) : null}
            {eventHasLecturers(event.type) &&
            event.lecturers?.includes("איש חוץ") ? (
                    <PersonChip event={event} key="איש חוץ" personData="איש חוץ" />
                ) : null}
            {presentInstructors.map((instructor) => (
                <PersonChip
                    event={event}
                    instructorId={instructor}
                    key={instructor}
                />
            ))}
        </Box>
    );
}
