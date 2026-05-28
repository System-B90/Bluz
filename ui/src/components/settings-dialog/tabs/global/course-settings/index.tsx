import AddIcon from "@mui/icons-material/Add";
import LayersIcon from "@mui/icons-material/Layers";
import { Box, Button, Typography } from "@mui/material";
import { useCallback } from "react";

import { useCourses } from "@/components/base/CoursesProvider";
import { CourseItem } from "@/components/settings-dialog/tabs/global/course-settings/CourseItem";

export function CourseSettings() {
    const { courses, addCourse, updateCoursePartial, deleteCourse } = useCourses();

    const handleCreate = useCallback(() => {
        // Instantly triggers optimistic update & auto-save API add
        void addCourse({
            name: "מסלול חדש",
            color: "#67C8DD", // Brand turquoise as default
        });
    }, [addCourse]);

    const handleUpdateCourse = useCallback(
        (id: string, name?: string, color?: null | string) => {
            const changes: any = {};
            if (name !== undefined) changes.name = name;
            if (color !== undefined) changes.color = color;
            void updateCoursePartial(id, changes);
        },
        [updateCoursePartial],
    );

    return (
        <Box
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: 3,
                boxShadow: (theme) =>
                    theme.palette.mode === "light"
                        ? "0 8px 24px rgba(103, 200, 221, 0.04)"
                        : "0 8px 24px rgba(0, 0, 0, 0.2)",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                height: "100%",
                justifyContent: "space-between",
            }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0 }}>
                {/* Header */}
                <Box alignItems="center" display="flex" gap={1.5} mb={2.5}>
                    <Box
                        sx={{
                            p: 1,
                            borderRadius: "10px",
                            bgcolor: "secondary.light",
                            color: "secondary.contrastText",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <LayersIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                        <Typography
                            sx={{
                                fontWeight: 800,
                                fontSize: "1.1rem",
                                fontFamily: "Assistant, sans-serif",
                                color: "text.primary",
                            }}
                        >
                            מסלולים
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: "0.75rem",
                                color: "text.secondary",
                                fontFamily: "Assistant, sans-serif",
                            }}
                        >
                            הגדרת מסלולים וצבעים לתצוגה ביומן
                        </Typography>
                    </Box>
                </Box>

                {/* Courses List Container */}
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 1.5,
                        alignItems: "flex-start",
                        flexGrow: 1,
                        overflowY: "auto",
                        pr: 0.5,
                        minHeight: 180,
                    }}
                >
                    {courses.map((course) => (
                        <CourseItem
                            course={course}
                            key={course.id}
                            onDelete={deleteCourse}
                            onUpdate={handleUpdateCourse}
                        />
                    ))}
                </Box>
            </Box>

            {/* Create Button */}
            <Box sx={{ mt: 2 }}>
                <Button
                    color="secondary"
                    fullWidth
                    onClick={handleCreate}
                    startIcon={<AddIcon sx={{ ml: 0.5 }} />}
                    sx={{
                        borderRadius: "10px",
                        py: 1.2,
                        boxShadow: "0 4px 12px rgba(26, 60, 89, 0.15)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: "0 6px 16px rgba(26, 60, 89, 0.25)",
                        },
                    }}
                    variant="contained"
                >
                    יצירת מסלול חדש
                </Button>
            </Box>
        </Box>
    );
}
