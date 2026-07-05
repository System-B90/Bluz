import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
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
import { calculateMinimumRequiredTimeForModule } from "@/components/gantt/utils";

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
            moduleDoc
                ? calculateMinimumRequiredTimeForModule(moduleDoc, state)
                : 0,
        [moduleDoc, state],
    );

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: moduleId });

    const editClickHandler = useCallback(() => {
        openModuleDialog(syllabusId, moduleId);
    }, [moduleId, syllabusId, openModuleDialog]);

    if (!moduleDoc) {
        return (
            <TableRow>
                <TableCell sx={{ width: "1rem" }} />
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
        <TableRow
            hover
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.4 : 1,
            }}
        >
            <TableCell sx={{ width: "1rem", pr: 0, cursor: "grab" }} {...attributes} {...listeners}>
                <DragIndicatorIcon fontSize="small" sx={{ color: "text.disabled", display: "block" }} />
            </TableCell>
            <TableCell>
                <Typography variant="body2">{moduleDoc.title}</Typography>
                {(moduleDoc.shuffles ?? []).map((shuffle) => (
                    <Chip
                        key={shuffle}
                        label={shuffle}
                        size="small"
                        sx={{ marginInlineEnd: 0.5, mt: 0.25 }}
                        variant="outlined"
                    />
                ))}
            </TableCell>
            <TableCell>
                {minimumRequiredTime !== undefined ? (
                    minimumRequiredTime
                ) : (
                    <CircularProgress size="1rem" />
                )}
            </TableCell>
            <TableCell>
                <Tooltip placement="top" title="עריכת מערך">
                    <IconButton
                        color="primary"
                        onClick={editClickHandler}
                        size="small"
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}
