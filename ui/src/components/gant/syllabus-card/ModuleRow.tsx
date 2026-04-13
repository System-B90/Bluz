import { ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useModule } from '@/components/gant/state/hooks';
import { useCurriculumProviderActions, useCurriculumState } from '@/components/gant/state/provider';
import { calculateAllocatedTimeForModule, calculateMinimumRequiredTimeForModule } from '@/components/gant/utils';
import EditIcon from '@mui/icons-material/Edit';
import
{
    CircularProgress,
    IconButton,
    Skeleton,
    TableCell,
    TableRow,
    Tooltip,
    Typography
} from '@mui/material';
import { useCallback, useMemo } from 'react';

export function ModuleRow({ moduleId, syllabusId }: { moduleId: ModuleId; syllabusId: SyllabusId; })
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
                    <Skeleton variant="circular" width={ 24 } height={ 24 } />
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
            <TableCell>
                { allocatedTime !== undefined ? allocatedTime : <CircularProgress size="1rem" /> }
            </TableCell>
            <TableCell>
                <Tooltip title="ערוך מערך" placement="top">
                    <IconButton size="small" onClick={ editClickHandler } color="primary">
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}
