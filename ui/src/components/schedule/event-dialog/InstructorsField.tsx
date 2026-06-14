import Box, { BoxProps } from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { SelectChangeEvent } from "@mui/material/Select";
import { useCallback, useMemo, useState } from "react";

import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { InstructorSelect } from "@/components/base/InstructorSelect";
import { useOutsiders } from "@/components/base/OutsidersProvider";
import { EventFieldProps } from "@/components/schedule/event-dialog/utils";
import { EventType } from "@/components/schedule/types/event";

type InstructorsFieldProps = {} & EventFieldProps;
type LecturerSelectionFieldProps = {
    selectedInstructors?: Array<number>;
} & InstructorsFieldProps &
    BoxProps;

function LecturerSelectionField({
    event,
    onBlurCallback,
    selectedInstructors: _selectedInstructors = [],
    ...props
}: LecturerSelectionFieldProps) {
    const { getInstructor } = useHiveUsers();
    const { getOutsider } = useOutsiders();
    const currentLecturers = event?.lecturers ?? [];

    const [favoriteOutsiders] = useState<Array<string>>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("bluz_personal_settings");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed && Array.isArray(parsed.favoriteOutsiders)) {
                        return parsed.favoriteOutsiders;
                    }
                } catch (e) {
                    console.error("Failed to load favorite outsiders", e);
                }
            }
        }
        return [];
    });

    const handleChange = useCallback(
        (ev: SelectChangeEvent<typeof currentLecturers>) => {
            const {
                target: { value },
            } = ev;

            // Handle potential string autofill values vs actual arrays
            const newIds =
                typeof value === "string"
                    ? value.split(",").map((v) => {
                        if (v === "איש חוץ") return "איש חוץ";
                        if (v.startsWith("outsider-")) return v;
                        return Number(v);
                    })
                    : value;

            onBlurCallback({ ...event, lecturers: newIds });
        },
        [event, onBlurCallback],
    );

    const handleDelete = useCallback(
        (idToDelete: number | string) => {
            const newIds = (event?.lecturers ?? []).filter(
                (id) => id !== idToDelete,
            );
            onBlurCallback({ ...event, lecturers: newIds });
        },
        [event, onBlurCallback],
    );

    return (
        <Box {...props}>
            <FormControl fullWidth={true}>
                <InputLabel>מרצים</InputLabel>
                <InstructorSelect
                    favoriteOutsiders={favoriteOutsiders}
                    label="מרצים"
                    multiple
                    onChange={handleChange}
                    renderValue={(selected) => (
                        <Box
                            sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                            {selected.map((id) => {
                                // Look up instructor/outsider details by ID
                                const outsider =
                                    typeof id === "string" &&
                                    id.startsWith("outsider-")
                                        ? getOutsider(id)
                                        : null;
                                const lecturer =
                                    typeof id === "number"
                                        ? getInstructor(id)
                                        : outsider
                                            ? { id, display_name: outsider.name }
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
                    showOutsiders
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
                </InstructorSelect>
            </FormControl>
        </Box>
    );
}

export function InstructorsField({
    event,
    onBlurCallback,
}: InstructorsFieldProps) {
    const { getInstructor } = useHiveUsers();
    const currentInstructors = event?.instructors ?? [];

    const isLecture = useMemo(
        () => event?.type === EventType.LECTURE,
        [event?.type],
    );

    const handleChange = useCallback(
        (ev: SelectChangeEvent<typeof currentInstructors>) => {
            const {
                target: { value },
            } = ev;

            // Handle potential string autofill values vs actual arrays
            const newIds =
                typeof value === "string"
                    ? value.split(",").map(Number)
                    : value;

            onBlurCallback({ ...event, instructors: newIds as Array<number> });
        },
        [event, onBlurCallback],
    );

    const handleDelete = useCallback(
        (idToDelete: number) => {
            const newIds = (event?.instructors ?? []).filter(
                (id) => id !== idToDelete,
            );
            onBlurCallback({ ...event, instructors: newIds });
        },
        [event, onBlurCallback],
    );

    return (
        <Box
            alignItems={"flex-start"}
            display={"flex"}
            flexDirection={"row"}
            flexWrap={"nowrap"}
            width={"100%"}
        >
            <Box flexGrow={1}>
                <FormControl fullWidth={true}>
                    <InputLabel>מבוזרים</InputLabel>
                    <InstructorSelect
                        label="מבוזרים"
                        multiple
                        onChange={handleChange}
                        renderValue={(selected) => (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.5,
                                }}
                            >
                                {selected.map((id) => {
                                    // Look up instructor details by ID
                                    const instructor = getInstructor(id);
                                    return (
                                        <Chip
                                            key={id}
                                            label={
                                                instructor?.display_name ?? id
                                            }
                                            onDelete={() => handleDelete(id)}
                                            // Prevent menu from opening when deleting
                                            onMouseDown={(e) =>
                                                e.stopPropagation()
                                            }
                                            size="small"
                                        />
                                    );
                                })}
                            </Box>
                        )}
                        value={currentInstructors}
                    />
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
