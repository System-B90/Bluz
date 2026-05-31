import {
    Box,
    BoxProps,
    Chip,
    FormControl,
    InputLabel,
    ListSubheader,
    MenuItem,
    Select,
    SelectChangeEvent,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";

import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { EventFieldProps } from "@/components/schedule/event-dialog/utils";
import { EventType } from "@/components/schedule/types/event";

type InstructorsFieldProps = {} & EventFieldProps;
type LecturerSelectionFieldProps = {
    selectedInstructors?: Array<number>;
} & InstructorsFieldProps & BoxProps;

function LecturerSelectionField({
    event,
    onBlurCallback,
    selectedInstructors = [],
    ...props
}: LecturerSelectionFieldProps) {
    const { instructors, getInstructor } = useHiveUsers();
    const [currentLecturers, setCurrentLecturers] = useState(
        event?.lecturers ?? [],
    );

    const { selectedList, remainingList } = useMemo(() => {
        const selectedSet = new Set(selectedInstructors);
        const selected: typeof instructors = [];
        const remaining: typeof instructors = [];
        for (const instructor of instructors) {
            if (selectedSet.has(instructor.id)) {
                selected.push(instructor);
            } else {
                remaining.push(instructor);
            }
        }
        return { selectedList: selected, remainingList: remaining };
    }, [instructors, selectedInstructors]);

    const handleChange = useCallback(
        (ev: SelectChangeEvent<typeof currentLecturers>) => {
            const {
                target: { value },
            } = ev;

            // Handle potential string autofill values vs actual arrays
            const newIds =
                typeof value === "string"
                    ? value
                        .split(",")
                        .map((v) => (v === "איש חוץ" ? "איש חוץ" : Number(v)))
                    : value;

            setCurrentLecturers(newIds);
        },
        [],
    );

    const handleDelete = useCallback((idToDelete: number | string) => {
        setCurrentLecturers((prev) =>
            (prev ?? []).filter((id) => id !== idToDelete),
        );
    }, []);

    const handleBlur = useCallback(() => {
        onBlurCallback({ ...event, lecturers: currentLecturers });
    }, [event, currentLecturers, onBlurCallback]);

    return (
        <Box {...props}>
            <FormControl fullWidth={true}>
                <InputLabel>מרצים</InputLabel>
                <Select
                    label="מרצים"
                    multiple
                    onBlur={handleBlur}
                    onChange={handleChange}
                    renderValue={(selected) => (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                            {selected.map((id) => {
                                // Look up instructor details by ID
                                const lecturer =
                                    typeof id === "number"
                                        ? getInstructor(id)
                                        : { id, display_name: id };
                                return (
                                    <Chip
                                        key={id}
                                        label={lecturer?.display_name ?? id}
                                        onDelete={() => handleDelete(id)}
                                        // Prevent menu from opening when deleting
                                        onMouseDown={(e) => e.stopPropagation()}
                                        size="small"
                                    />
                                );
                            })}
                        </Box>
                    )}
                    value={currentLecturers}
                >
                    <MenuItem
                        key={"outside-lecturer"}
                        sx={{
                            borderBottomWidth: "0.2rem",
                            borderBottomStyle: "solid",
                            borderBottomColor: "hsl(var(--border))",
                        }}
                        value={"איש חוץ"}
                    >
                        איש חוץ
                    </MenuItem>
                    {selectedList.length > 0 ? (
                        [
                            <ListSubheader disableSticky key="subheader-selected" sx={{ fontWeight: 'bold', lineHeight: '36px', color: 'primary.main', bgcolor: 'background.paper' }}>
                                מבוזרים שנבחרו
                            </ListSubheader>,
                            ...selectedList.map((instructor) => (
                                <MenuItem key={instructor.id} value={instructor.id}>
                                    {instructor.display_name}
                                </MenuItem>
                            )),
                            <ListSubheader disableSticky key="subheader-remaining" sx={{
                                borderTopWidth: "0.2rem",
                                borderTopStyle: "solid",
                                borderTopColor: "hsl(var(--border))",
                                fontWeight: 'bold',
                                lineHeight: '36px',
                                color: 'text.secondary',
                                bgcolor: 'background.paper'
                            }}>
                                שאר הסגל
                            </ListSubheader>,
                            ...remainingList.map((instructor) => (
                                <MenuItem key={instructor.id} value={instructor.id}>
                                    {instructor.display_name}
                                </MenuItem>
                            ))
                        ]
                    ) : (
                        instructors.map((instructor) => (
                            <MenuItem key={instructor.id} value={instructor.id}>
                                {instructor.display_name}
                            </MenuItem>
                        ))
                    )}
                </Select>
            </FormControl>
        </Box>
    );
}

export function InstructorsField({
    event,
    onBlurCallback,
}: InstructorsFieldProps) {
    const { instructors, getInstructor } = useHiveUsers();
    const [currentInstructors, setCurrentInstructors] = useState<Array<number>>(
        event?.instructors ?? [],
    );

    const isLecture = useMemo(
        () => event?.type === EventType.LECTURE,
        [event?.type],
    );

    const handleChange = useCallback(
        (event: SelectChangeEvent<typeof currentInstructors>) => {
            const {
                target: { value },
            } = event;

            // Handle potential string autofill values vs actual arrays
            const newIds =
                typeof value === "string" ? value.split(",").map(Number) : value;

            // Use functional update pattern for SetStateAction
            setCurrentInstructors(newIds as Array<number>);
        },
        [],
    );

    const handleDelete = useCallback((idToDelete: number) => {
        setCurrentInstructors((prev) =>
            (prev ?? []).filter((id) => id !== idToDelete),
        );
    }, []);

    const handleBlur = useCallback(() => {
        onBlurCallback({ ...event, instructors: currentInstructors });
    }, [event, currentInstructors, onBlurCallback]);

    return (
        <Box alignItems={"flex-start"} display={"flex"} flexDirection={'row'} flexWrap={'nowrap'} width={"100%"}>
            <Box flexGrow={1}>
                <FormControl fullWidth={true}>
                    <InputLabel>מבוזרים</InputLabel>
                    <Select
                        label="מבוזרים"
                        multiple
                        onBlur={handleBlur}
                        onChange={handleChange}
                        renderValue={(selected) => (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {selected.map((id) => {
                                    // Look up instructor details by ID
                                    const instructor = getInstructor(id);
                                    return (
                                        <Chip
                                            key={id}
                                            label={instructor?.display_name ?? id}
                                            onDelete={() => handleDelete(id)}
                                            // Prevent menu from opening when deleting
                                            onMouseDown={(e) => e.stopPropagation()}
                                            size="small"
                                        />
                                    );
                                })}
                            </Box>
                        )}
                        value={currentInstructors}
                    >
                        {instructors.map((instructor) => (
                            <MenuItem key={instructor.id} value={instructor.id}>
                                {instructor.display_name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>
            <Box
                sx={{
                    width: isLecture ? "30%" : "0%",
                    opacity: isLecture ? 1 : 0,
                    ml: isLecture ? 1 : 0,
                    pt: 1.5,
                    mt: -1.5,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "flex-start",
                    visibility: isLecture ? "visible" : "hidden",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
            >
                <LecturerSelectionField
                    event={event}
                    onBlurCallback={onBlurCallback}
                    selectedInstructors={currentInstructors}
                    sx={{
                        width: "100%",
                        minWidth: "250px",
                    }}
                />
            </Box>
        </Box>
    );
}
