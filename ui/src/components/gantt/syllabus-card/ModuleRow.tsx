import EditIcon from "@mui/icons-material/Edit";
import {
    CircularProgress,
    IconButton,
    Skeleton,
    TableCell,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import { useCallback, useMemo } from "react";

import {
    GanttCurriculumId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { useModule } from "@/components/gantt/state/hooks/UseModule";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";
import {
    calculateMinimumRequiredTimeForModule,
} from "@/components/gantt/utils";

export function ModuleRow({
    moduleId,
    syllabusId,
    curriculumId: _curriculumId,
}: {
  moduleId: GanttModuleId;
  syllabusId: GanttSyllabusId;
  curriculumId: GanttCurriculumId;
}) {
    const state = useCurriculumState();
    const { openModuleDialog } = useCurriculumProviderActions();
    const moduleDoc = useModule(moduleId);
    const minimumRequiredTime = useMemo(
        () =>
            moduleDoc ? calculateMinimumRequiredTimeForModule(moduleDoc, state) : 0,
        [moduleDoc, state],
    );

    const editClickHandler = useCallback(() => {
        openModuleDialog(syllabusId, moduleId);
    }, [moduleId, syllabusId, openModuleDialog]);

    if (!moduleDoc) {
        return (
            <TableRow>
                <TableCell>
                    <Skeleton variant="text" width="80%" />
                </TableCell>
                <TableCell>
                    <Skeleton variant="text" width="40px" />
                </TableCell>
                <TableCell>
                    <Skeleton height={24} variant="circular" width={24} />
                </TableCell>
            </TableRow>
        );
    }

    return (
        <TableRow hover>
            <TableCell>
                <Typography variant="body2">{moduleDoc.title}</Typography>
            </TableCell>
            <TableCell>
                {minimumRequiredTime !== undefined ? (
                    minimumRequiredTime
                ) : (
                    <CircularProgress size="1rem" />
                )}
            </TableCell>
            <TableCell>
                <Tooltip placement="top" title="ערוך מערך">
                    <IconButton color="primary" onClick={editClickHandler} size="small">
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}
