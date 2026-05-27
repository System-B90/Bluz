import ClearIcon from "@mui/icons-material/Clear";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { Dayjs } from "dayjs";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    GanttCurriculum,
    GanttCurriculumId,
} from "@/api-shared/types/gantt/models";
import {
    getCourseEndDate,
    getCourseStartDay,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useCurriculumActions } from "@/components/gantt/state/hooks/gantt-funcs/UseCurriculumActions";

export type CourseStartDateControlProps = {
  curriculum: GanttCurriculum;
  curriculumId: GanttCurriculumId;
};

export function CourseStartDateControl({
    curriculum,
    curriculumId,
}: CourseStartDateControlProps) {
    const { enqueueSnackbar } = useSnackbar();
    const { updateCurriculum } = useCurriculumActions();

    const selectedDate = useMemo(
        () => getCourseStartDay(curriculum.startDate),
        [curriculum.startDate],
    );

    const courseEndDate = useMemo(
        () => getCourseEndDate(curriculum.startDate, curriculum.weeks.length),
        [curriculum.startDate, curriculum.weeks.length],
    );

    const saveStartDate = useCallback(
        (nextValue: Dayjs | null) => {
            const nextStartDate =
        nextValue && nextValue.isValid()
            ? nextValue.format("YYYY-MM-DD")
            : null;

            if (nextStartDate === curriculum.startDate) {
                return;
            }

            void updateCurriculum(curriculumId, { startDate: nextStartDate }).catch(
                (error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שמירת תאריך תחילת הגאנט נכשלה!",
                        error,
                    ),
            );
        },
        [curriculum.startDate, curriculumId, enqueueSnackbar, updateCurriculum],
    );

    const clearStartDate = useCallback(() => {
        saveStartDate(null);
    }, [saveStartDate]);

    return (
        <Box alignItems="center" display="flex" flexWrap="wrap" gap={1.5}>
            <DatePicker
                format="DD/MM/YYYY"
                label="יום ראשון של שבוע 1"
                onChange={saveStartDate}
                slotProps={{
                    textField: {
                        size: "small",
                        sx: { width: 190 },
                    },
                }}
                value={selectedDate}
            />
            <Tooltip title="ניקוי תאריך התחלה">
                <span>
                    <IconButton
                        disabled={!curriculum.startDate}
                        onClick={clearStartDate}
                        size="small"
                    >
                        <ClearIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Typography color="text.secondary" variant="body2">
                {selectedDate && courseEndDate
                    ? `סיום משוער: ${courseEndDate.format("DD/MM/YYYY")}`
                    : "בחרו תאריך כדי להציג תאריכים בטבלה וברצף הזמן"}
            </Typography>
        </Box>
    );
}
