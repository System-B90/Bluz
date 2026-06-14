/**
 * Name: WorkTimePanel.tsx
 * Purpose: Management interface for curriculum work weeks and daily hour allocations.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { GanttWeekId } from "@/api-shared/types/gantt/models";
import { OverviewTab } from "@/components/gantt/curriculum-view/components/WorkTimePanel/OverviewTab";
import { WorkTimePanelProps } from "@/components/gantt/curriculum-view/components/WorkTimePanel/types";
import { useWorkTimePanelLogic } from "@/components/gantt/curriculum-view/components/WorkTimePanel/UseWorkTimePanelLogic";
import { cloneWeeks } from "@/components/gantt/curriculum-view/components/WorkTimePanel/utils";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";

export function WorkTimePanel({
    curriculumId,
    curriculum,
}: WorkTimePanelProps) {
    const { enqueueSnackbar } = useSnackbar();
    const [localWeekIds, setLocalWeekIds] = useState<Array<GanttWeekId>>(() =>
        cloneWeeks(curriculum?.weeks ?? []),
    );
    const { createWeek } = useWeekActions();

    const canEdit = curriculumId !== null;
    const curriculumWeekIds = curriculum?.weeks;
    const _logic = useWorkTimePanelLogic(
        curriculumId,
        curriculumWeekIds ?? [],
        localWeekIds,
        setLocalWeekIds,
    );

    const addWeek = useCallback(() => {
        if (!curriculumId) return;

        // Calculate next week number based on existing weeks or start from 1
        let nextNumber = 1;
        if (curriculumWeekIds && curriculumWeekIds.length > 0) {
            // Would need to fetch max week number, for now just increment length
            nextNumber = curriculumWeekIds.length + 1;
        }

        createWeek({
            curriculumId,
            number: nextNumber,
            comment: "",
            weekendDuty: false,
        }).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "הוספת שבוע נכשלה!",
                error,
            ),
        );
    }, [curriculumId, curriculumWeekIds, createWeek, enqueueSnackbar]);

    if (!curriculum) {
        return (
            <Card
                className="p-4 min-h-[150px] flex items-center justify-center"
            >
                <CircularProgress />
            </Card>
        );
    }

    return (
        <Card
            className="p-4 w-full max-w-[22rem] flex flex-col h-full flex-grow"
        >
            <Box
                alignItems="center"
                display="flex"
                justifyContent="space-between"
                mb={0.5}
            >
                <Typography gutterBottom variant="subtitle1">
                    שעות עבודה לשיבוץ
                </Typography>
                <Tooltip title="הוסף שבוע">
                    <span>
                        <IconButton
                            color="primary"
                            disabled={!canEdit}
                            onClick={() => void addWeek()}
                            size="small"
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            <OverviewTab
                curriculumId={curriculumId ?? ""}
                weeks={localWeekIds}
            />
        </Card>
    );
}
