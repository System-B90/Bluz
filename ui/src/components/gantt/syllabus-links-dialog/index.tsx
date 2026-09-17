import LabelIcon from "@mui/icons-material/Label";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { Dispatch, SetStateAction, useCallback, useId } from "react";

import { CourseId } from "@/api-shared/types/course";
import { GanttSyllabus, GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { InstructorSelect } from "@/components/base/InstructorSelect";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";

export type SyllabusLinksDialogProps = {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    syllabusId: GanttSyllabusId | null;
};

const EMPTY_COURSES: Array<CourseId> = [];
const EMPTY_LEADS: Array<number> = [];

/**
 * Links a syllabus to its courses (מסלולים) and אחראי מקצוע instructors
 * (#702). Both are what the gantt filters narrow by, and the leads are pinned
 * to the top of every orchestrator select under the syllabus.
 */
export function SyllabusLinksDialog({
    open,
    setOpen,
    syllabusId,
}: SyllabusLinksDialogProps) {
    const { enqueueSnackbar } = useSnackbar();
    const coursesLabelId = useId();
    const leadsLabelId = useId();
    const syllabus = useSyllabus(syllabusId as GanttSyllabusId);
    const { updateSyllabus } = useSyllabusActions();
    const { courses, getCourse } = useCourses();
    const { getInstructor } = useHiveUsers();

    const courseIds = syllabus?.courseIds ?? EMPTY_COURSES;
    const leadInstructorIds = syllabus?.leadInstructorIds ?? EMPTY_LEADS;

    const commit = useCallback(
        (updates: Partial<GanttSyllabus>) => {
            if (!syllabusId) return;
            updateSyllabus(syllabusId, updates).catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון שיוך המקצוע נכשל!",
                    error,
                ),
            );
        },
        [syllabusId, updateSyllabus, enqueueSnackbar],
    );

    const onCoursesChange = useCallback(
        (event: SelectChangeEvent<Array<CourseId>>) => {
            const value = event.target.value;
            commit({
                courseIds: typeof value === "string" ? value.split(",") : value,
            });
        },
        [commit],
    );

    const onLeadsChange = useCallback(
        (event: SelectChangeEvent<Array<number>>) => {
            const value = event.target.value;
            commit({
                leadInstructorIds:
                    typeof value === "string"
                        ? value.split(",").map(Number)
                        : value,
            });
        },
        [commit],
    );

    const closeHandler = useCallback(() => setOpen(false), [setOpen]);

    return (
        <Dialog fullWidth maxWidth="sm" onClose={closeHandler} open={open}>
            <DialogTitle>
                <Stack alignItems="center" direction="row" gap={1}>
                    <LabelIcon color="action" />
                    <Box>
                        שיוך מקצוע
                        {syllabus ? (
                            <Typography color="text.secondary" variant="body2">
                                {syllabus.title}
                            </Typography>
                        ) : null}
                    </Box>
                </Stack>
            </DialogTitle>
            <DialogContent>
                <Stack gap={2.5} pt={1}>
                    {courseIds.length === 0 ? (
                        <Alert severity="warning">
                            למקצוע אין מסלול משויך. שיוך לפחות מסלול אחד מאפשר
                            לסנן את הגאנט לפי מסלול.
                        </Alert>
                    ) : null}

                    <FormControl fullWidth size="small">
                        <InputLabel id={coursesLabelId}>מסלולים</InputLabel>
                        <Select<Array<CourseId>>
                            label="מסלולים"
                            labelId={coursesLabelId}
                            multiple
                            onChange={onCoursesChange}
                            renderValue={(selected) => (
                                <Box display="flex" flexWrap="wrap" gap={0.5}>
                                    {selected.map((id) => {
                                        const course = getCourse(id);
                                        if (!course) return null;
                                        return (
                                            <Chip
                                                key={id}
                                                label={course.name}
                                                size="small"
                                                sx={{ bgcolor: course.color }}
                                            />
                                        );
                                    })}
                                </Box>
                            )}
                            value={courseIds}
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
                        <InputLabel id={leadsLabelId}>אחראי מקצוע</InputLabel>
                        <InstructorSelect<Array<number>>
                            excludeTeachers
                            label="אחראי מקצוע"
                            labelId={leadsLabelId}
                            multiple
                            onChange={onLeadsChange}
                            renderValue={(selected) => (
                                <Box display="flex" flexWrap="wrap" gap={0.5}>
                                    {selected.map((id) => (
                                        <Chip
                                            key={id}
                                            label={
                                                getInstructor(id)?.display_name ??
                                                id
                                            }
                                            size="small"
                                        />
                                    ))}
                                </Box>
                            )}
                            value={leadInstructorIds}
                        />
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={closeHandler}>סגירה</Button>
            </DialogActions>
        </Dialog>
    );
}
