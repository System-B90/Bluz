import FilterListIcon from "@mui/icons-material/FilterList";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useId, useState } from "react";

import { CourseId } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { InstructorSelect } from "@/components/base/InstructorSelect";
import { useGanttFilters } from "@/components/gantt/state/filters/Provider";

/** Popover with the gantt syllabus filters, mirroring the schedule's filter icon. */
export function GanttFilterButton() {
    const coursesLabelId = useId();
    const leadsLabelId = useId();
    const { courses, getCourse } = useCourses();
    const { getInstructor } = useHiveUsers();
    const { values, setFilter, clearFilters, hasActiveFilters, description } =
        useGanttFilters();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const open = Boolean(anchorEl);

    const onCoursesChange = useCallback(
        (event: SelectChangeEvent<Array<CourseId>>) => {
            const value = event.target.value;
            setFilter(
                "courseIds",
                typeof value === "string" ? value.split(",") : value,
            );
        },
        [setFilter],
    );

    const onLeadsChange = useCallback(
        (event: SelectChangeEvent<Array<number>>) => {
            const value = event.target.value;
            setFilter(
                "leadInstructorIds",
                typeof value === "string" ? value.split(",").map(Number) : value,
            );
        },
        [setFilter],
    );

    const activeCount =
        (values.courseIds.length > 0 ? 1 : 0) +
        (values.leadInstructorIds.length > 0 ? 1 : 0);

    return (
        <>
            <Tooltip title={open ? "הסתרת מסננים" : "סינון סילבוסים"}>
                <IconButton
                    color={hasActiveFilters || open ? "primary" : "inherit"}
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    size="small"
                >
                    <Badge badgeContent={activeCount} color="primary">
                        <FilterListIcon fontSize="small" />
                    </Badge>
                </IconButton>
            </Tooltip>
            <Popover
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                onClose={() => setAnchorEl(null)}
                open={open}
                slotProps={{
                    paper: {
                        sx: { p: 2, mt: 1, borderRadius: "12px", direction: "rtl" },
                    },
                }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
                <Stack gap={2} minWidth={280}>
                    <FormControl fullWidth size="small">
                        <InputLabel id={coursesLabelId} size="small">
                            סינון לפי מסלולים
                        </InputLabel>
                        <Select<Array<CourseId>>
                            label="סינון לפי מסלולים"
                            labelId={coursesLabelId}
                            MenuProps={{ disablePortal: true }}
                            multiple
                            onChange={onCoursesChange}
                            renderValue={(selected) => (
                                <Box display="flex" flexWrap="wrap" gap={0.5}>
                                    {selected.map((id) => {
                                        const course = getCourse(id);
                                        return (
                                            <Chip
                                                key={id}
                                                label={course?.name ?? id}
                                                size="small"
                                                sx={{ bgcolor: course?.color }}
                                            />
                                        );
                                    })}
                                </Box>
                            )}
                            size="small"
                            value={values.courseIds}
                        >
                            {courses.map((course) => (
                                <MenuItem
                                    key={course.id}
                                    sx={{
                                        textDecorationColor: course.color,
                                        textDecorationLine: "underline",
                                    }}
                                    value={course.id}
                                >
                                    {course.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel id={leadsLabelId} size="small">
                            סינון לפי אחראי מקצוע
                        </InputLabel>
                        <InstructorSelect<Array<number>>
                            excludeTeachers
                            label="סינון לפי אחראי מקצוע"
                            labelId={leadsLabelId}
                            MenuProps={{ disablePortal: true }}
                            multiple
                            onChange={onLeadsChange}
                            renderValue={(selected) => (
                                <Box display="flex" flexWrap="wrap" gap={0.5}>
                                    {selected.map((id) => (
                                        <Chip
                                            key={id}
                                            label={getInstructor(id)?.display_name ?? id}
                                            size="small"
                                        />
                                    ))}
                                </Box>
                            )}
                            size="small"
                            value={values.leadInstructorIds}
                        />
                    </FormControl>

                    <Typography color="text.secondary" variant="body2">
                        {hasActiveFilters
                            ? description
                            : "לא פעיל סינון — מוצגים כל המקצועות בגאנט."}
                    </Typography>

                    {hasActiveFilters ? (
                        <Button onClick={clearFilters} size="small" variant="outlined">
                            ניקוי מסננים
                        </Button>
                    ) : null}
                </Stack>
            </Popover>
        </>
    );
}
