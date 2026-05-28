import assert from "assert";

import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import WarningIcon from "@mui/icons-material/Warning";
import {
    Box,
    BoxProps,
    ChipProps,
    Link,
    Tooltip,
    Typography,
} from "@mui/material";
import { useMemo } from "react";

import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { shortenInstructorName } from "@/components/schedule/event-component/nameUtils";
import {
    EventType,
    getPresentInstructors,
    Event,
} from "@/components/schedule/types/event";

/** Lightweight tag style — replaces MUI Chip for a more compact, professional look. */
const tagSx = (isLecturer: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    px: 0.6,
    py: 0.1,
    borderRadius: "4px",
    fontSize: "0.72rem",
    lineHeight: 1.4,
    fontWeight: isLecturer ? 600 : 400,
    whiteSpace: "nowrap" as const,
    border: "1px solid",
    borderColor: isLecturer ? "currentColor" : "var(--event-border)",
    backgroundColor: isLecturer ? "var(--event-emphasis-bg)" : "transparent",
    order: isLecturer ? 1 : 2,
    color: "inherit",
});

export function PersonChip({
    instructorId,
    personData,
    event,
    size: _size,
    ...props
}: { instructorId?: number; personData?: any; event: Event } & ChipProps) {
    const { getInstructor } = useHiveUsers();
    const instructor = useMemo(
        () => (instructorId ? getInstructor(instructorId) : personData),
        [instructorId, getInstructor, personData],
    );

    assert(
        !(instructorId !== undefined && personData !== undefined),
        "Either instructorId or personData, not both must be supplied!",
    );

    const isLecturer =
    event.type === EventType.LECTURE &&
    event.lecturers?.includes(instructorId ?? personData);

    const fullName: string =
        instructor?.display_name ?? personData ?? instructorId;
    const shortName = typeof fullName === "string"
        ? shortenInstructorName(fullName)
        : fullName;

    return (
        <Tooltip title={fullName}>
            <Box
                component="span"
                sx={tagSx(!!isLecturer)}
            >
                <Link color="inherit" href="a" underline="hover">
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
    return (
        <Box
            alignItems="center"
            display="flex"
            flexDirection="row"
            flexWrap="wrap"
            gap={0.4}
            {...props}
        >
            {getPresentInstructors(event).length === 0 ? (
                <>
                    <WarningIcon
                        color="error"
                        sx={{ fontSize: "0.85rem", mr: 0.3 }}
                    />
                    <Typography color="error" fontWeight={600} variant="caption">
                        אין מבוזרים
                    </Typography>
                </>
            ) : (
                <>
                    {showCaption ? <Tooltip title={event.instructors.length === 1 ? "מבוזר" : "מבוזרים"}>
                        <PersonOutlinedIcon
                            sx={{ fontSize: "0.85rem", opacity: 0.6 }}
                        />
                    </Tooltip> : null}
                    {event.type === EventType.LECTURE &&
                        event.lecturers?.includes("איש חוץ") ? (
                            <PersonChip
                                event={event}
                                key="איש חוץ"
                                personData="איש חוץ"
                            />
                        ) : null}
                    {getPresentInstructors(event).map((instructor) => (
                        <PersonChip
                            event={event}
                            instructorId={instructor}
                            key={instructor}
                        />
                    ))}
                </>
            )}
        </Box>
    );
}
