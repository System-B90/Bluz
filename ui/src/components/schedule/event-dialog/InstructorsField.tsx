import {
    Box,
    BoxProps,
    Chip,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";

import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { EventFieldProps } from "@/components/schedule/event-dialog/utils";
import { EventType } from "@/components/schedule/types/event";

interface InstructorsFieldProps extends EventFieldProps {}

function LecturerSelectionField({
    event,
    onBlurCallback,
    ...props
}: InstructorsFieldProps & BoxProps) {
    const { instructors, getInstructor } = useHiveUsers();
    const [currentLecturers, setCurrentLecturers] = useState(
        event?.lecturers ?? [],
    );

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
                    {instructors.map((instructor) => (
                        <MenuItem key={instructor.id} value={instructor.id}>
                            {instructor.display_name}
                        </MenuItem>
                    ))}
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
    const [currentInstructors, setCurrentInstructors] = useState(
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
            setCurrentInstructors(newIds);
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
        <Box display={"flex"} gap={isLecture ? 2 : 0} width={"100%"}>
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
            {isLecture ? (
                <LecturerSelectionField
                    className="w-[30%]"
                    event={event}
                    onBlurCallback={onBlurCallback}
                />
            ) : null}
        </Box>
    );
}
