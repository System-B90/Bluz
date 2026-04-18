import assert from "assert";

import WarningIcon from "@mui/icons-material/Warning";
import {
    Box,
    BoxProps,
    Chip,
    ChipProps,
    Link,
    Stack,
    Typography,
} from "@mui/material";
import { useMemo } from "react";

import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import {
    EventType,
    getPresentInstructors,
    Event,
} from "@/components/schedule/types/event";

export function PersonChip({
    instructorId,
    personData,
    event,
    size,
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
    event.type === "lecture" &&
    event.lecturers?.includes(instructorId ?? personData);

    /** TODO: Link component to mattermost chat with the mentor */

    return (
        <Chip
            color={isLecturer ? "primary" : "default"}
            key={instructorId ?? personData ?? "unknown"}
            label={
                <Link color={"inherit"} href={`a`} underline="hover">
                    {instructor?.display_name ?? personData ?? instructorId}
                </Link>
            }
            size={size ?? "small"}
            sx={{ order: isLecturer ? 1 : 2, color: isLecturer ? "" : "inherit" }}
            {...props}
        />
    );
}

export function InstructorsList({
    event,
    chipSize,
    showCaption = true,
    ...props
}: {
  event: Event;
  showCaption?: boolean;
  chipSize?: ChipProps["size"];
} & BoxProps) {
    return (
        <Box {...props}>
            {getPresentInstructors(event).length === 0 ? (
                <Box alignItems={"center"} display={"flex"} flexDirection={"row"}>
                    <WarningIcon
                        color="error"
                        fontSize="inherit"
                        sx={{ verticalAlign: "middle", mr: 0.5 }}
                    />
                    <Typography color="error" fontWeight={600} variant="caption">
            אין מבוזרים
                    </Typography>
                </Box>
            ) : (
                <>
                    {showCaption ? (
                        <Typography
                            fontWeight={600}
                            marginTop={0}
                            noWrap
                            paddingBottom={0}
                            variant="caption"
                        >
                            {event.instructors.length === 1 ? "מבוזר" : "מבוזרים"}
                        </Typography>
                    ) : null}
                    <Stack
                        direction={props.flexDirection === "column" ? "column" : "row"}
                        display={"flex"}
                        flexWrap={"wrap"}
                        gap={0.3}
                        sx={{ marginTop: "0 !important" }}
                    >
                        {event.type === EventType.LECTURE &&
            event.lecturers?.includes("איש חוץ") ? (
                                <PersonChip
                                    event={event}
                                    key={"איש חוץ"}
                                    personData={"איש חוץ"}
                                    size={chipSize}
                                />
                            ) : null}
                        {getPresentInstructors(event).map((instructor) => (
                            <PersonChip
                                event={event}
                                instructorId={instructor}
                                key={instructor}
                                size={chipSize}
                            />
                        ))}
                    </Stack>
                </>
            )}
        </Box>
    );
}
