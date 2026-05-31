import assert from "assert";

import PersonOffIcon from "@mui/icons-material/PersonOff";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import
{
    Box,
    BoxProps,
    ChipProps,
    Link,
    Tooltip,
} from "@mui/material";
import { useMemo } from "react";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { shortenInstructorName } from "@/components/schedule/event-component/NameUtils";
import
{
    Event,
    EventType,
    getPresentInstructors,
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
}: { instructorId?: number; personData?: any; event: Event; })
{
    const { getInstructor } = useHiveUsers();
    const instructor = useMemo(
        () => (instructorId ? getInstructor(instructorId) : personData),
        [ instructorId, getInstructor, personData ],
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
        <Tooltip title={ fullName }>
            <Box
                component="span"
                sx={ tagSx(!!isLecturer) }
            >
                <Link color="inherit" href="a" underline="hover">
                    { shortName }
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
    chipSize?: ChipProps[ "size" ];
} & BoxProps)
{
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
                    <PersonOffIcon
                        color="error"
                        sx={{ fontSize: "1.1rem" }}
                    />
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
            gap={ 0.4 }
            { ...props }
        >
            { showCaption ? <Tooltip title={ event.instructors.length === 1 ? "מבוזר" : "מבוזרים" }>
                <PersonOutlinedIcon
                    sx={ { fontSize: "0.85rem", opacity: 0.6 } }
                />
            </Tooltip> : null }
            { event.type === EventType.LECTURE &&
                event.lecturers?.includes("איש חוץ") ? (
                    <PersonChip
                        event={ event }
                        key="איש חוץ"
                        personData="איש חוץ"
                    />
                ) : null }
            { presentInstructors.map((instructor) => (
                <PersonChip
                    event={ event }
                    instructorId={ instructor }
                    key={ instructor }
                />
            )) }
        </Box>
    );
}
