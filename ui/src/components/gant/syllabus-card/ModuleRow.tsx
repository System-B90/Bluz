import EditIcon from '@mui/icons-material/Edit';
import
    {
        CircularProgress,
        IconButton,
        Skeleton,
        TableCell,
        TableCellProps,
        TableRow,
        Tooltip,
        Typography
    } from '@mui/material';
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from 'react';

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { CurriculumId, ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useModuleActions } from "@/components/gant/state/hooks/gant-funcs/UseModuleActions";
import { useModule } from '@/components/gant/state/hooks/UseModule';
import { useCurriculumProviderActions, useCurriculumState } from '@/components/gant/state/provider';
import { OpenHandsIcon } from "@/components/gant/syllabus-card/OpenHandsIcon";
import { calculateAllocatedTimeForModule, calculateMinimumRequiredTimeForModule } from '@/components/gant/utils';

interface AllocatedTimeTableCellProps extends TableCellProps
{
    moduleId: ModuleId;
    curriculumId: CurriculumId;
    minimumRequiredTime: number;
    allocatedTime: number | undefined;
}

function AllocatedTimeTableCell({ moduleId, curriculumId, allocatedTime, minimumRequiredTime, ...props }: AllocatedTimeTableCellProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const { allocateTimeToModule } = useModuleActions();
    const allocateTimeHandler = useCallback(() =>
    {
        allocateTimeToModule(moduleId, curriculumId, minimumRequiredTime)
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'הקצאת השעות נכשלה!', error));
    }, [ moduleId, curriculumId, minimumRequiredTime, allocateTimeToModule, enqueueSnackbar ]);

    return (
        <TableCell { ...props }>
            { allocatedTime !== undefined ? allocatedTime : <CircularProgress size="1rem" /> }
            <Tooltip title='הקצה את כל השעות'>
                <IconButton color="primary" onClick={ allocateTimeHandler } size="small">
                    <OpenHandsIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </TableCell>
    );
}

export function ModuleRow({ moduleId, syllabusId, curriculumId }: { moduleId: ModuleId; syllabusId: SyllabusId; curriculumId: CurriculumId; })
{
    const state = useCurriculumState();
    const { openModuleDialog } = useCurriculumProviderActions();
    const moduleDoc = useModule(moduleId);
    const minimumRequiredTime = useMemo(() => moduleDoc ? calculateMinimumRequiredTimeForModule(moduleDoc, state) : 0, [ moduleDoc, state ]);
    const allocatedTime = useMemo(() => moduleDoc ? calculateAllocatedTimeForModule(moduleDoc, state) : 0, [ moduleDoc, state ]);

    const editClickHandler = useCallback(() =>
    {
        openModuleDialog(syllabusId, moduleId);
    }, [ moduleId, syllabusId, openModuleDialog ]);

    if (!moduleDoc)
    {
        return (
            <TableRow>
                <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                <TableCell><Skeleton variant="text" width="40px" /></TableCell>
                <TableCell><Skeleton variant="text" width="40px" /></TableCell>
                <TableCell>
                    <Skeleton height={ 24 } variant="circular" width={ 24 } />
                </TableCell>
            </TableRow>
        );
    }

    return (
        <TableRow hover>
            <TableCell>
                <Typography variant="body2">{ moduleDoc.title }</Typography>
            </TableCell>
            <TableCell>
                { minimumRequiredTime !== undefined ? minimumRequiredTime : <CircularProgress size="1rem" /> }
            </TableCell>
            <AllocatedTimeTableCell allocatedTime={ allocatedTime } curriculumId={ curriculumId } minimumRequiredTime={ minimumRequiredTime } moduleId={ moduleId } />
            <TableCell>
                <Tooltip placement="top" title="ערוך מערך">
                    <IconButton color="primary" onClick={ editClickHandler } size="small">
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}
