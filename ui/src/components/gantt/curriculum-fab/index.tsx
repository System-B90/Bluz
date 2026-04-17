import MenuBookIcon from '@mui/icons-material/MenuBook';
import
    {
        Box,
        Fab,
        List,
        ListSubheader,
        Popover,
        Typography
    } from "@mui/material";
import { useSnackbar } from 'notistack';
import { Dispatch, MouseEvent, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/curriculum";
import { CurriculumActionItems } from '@/components/gantt/curriculum-fab/CurriculumActionItems';
import { CurriculumListItems } from "@/components/gantt/curriculum-fab/CurriculumListItems";
import { fetchDrawerData, sortCurriculumsByDraftAndUpdatedAt } from "@/components/gantt/curriculum-fab/utils";

export interface CurriculumDrawerProps
{
    open?: boolean;
    setOpen?: Dispatch<SetStateAction<boolean>>;
    setCurrentCurriculum: Dispatch<SetStateAction<GanttCurriculumId | null>>;
    currentCurriculum?: GanttCurriculumId | null;
}

const PANEL_WIDTH = 300;

export function CurriculumFab({
    setCurrentCurriculum,
    currentCurriculum,
}: CurriculumDrawerProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const [ curriculumsData, setCurriculumsData ] = useState<Record<GanttCurriculumId, GanttCurriculumDocument>>({} as Record<GanttCurriculumId, GanttCurriculumDocument>);
    const [ isFetchingDetails, setIsFetchingDetails ] = useState<boolean>(true);
    const [ anchorEl, setAnchorEl ] = useState<HTMLButtonElement | null>(null);
    const hasInitializedSelection = useRef(false);

    useEffect(() =>
    {
        let isMounted = true;
        void fetchDrawerData({ isMounted, enqueueSnackbar, setCurriculumsData, setIsFetchingDetails });
        return () => { isMounted = false; };
    }, [ enqueueSnackbar ]);

    const sortedIds = useMemo(() => sortCurriculumsByDraftAndUpdatedAt(curriculumsData), [ curriculumsData ]);

    useEffect(() =>
    {
        if (!hasInitializedSelection.current && sortedIds.length > 0 && !currentCurriculum)
        {
            setCurrentCurriculum(sortedIds[ 0 ]);
            hasInitializedSelection.current = true;
        }
    }, [ sortedIds, currentCurriculum, setCurrentCurriculum ]);

    const onCreateCallback = useCallback((newCurriculum: GanttCurriculumDocument) =>
    {
        setCurrentCurriculum(newCurriculum.id);
        setCurriculumsData((prev) => ({ ...prev, [ newCurriculum.id ]: newCurriculum }));
        setAnchorEl(null);
    }, [ setCurrentCurriculum ]);

    const onUpdateCallback = useCallback((updatedCurriculum: GanttCurriculumDocument) =>
    {
        setCurriculumsData((prev) => ({ ...prev, [ updatedCurriculum.id ]: updatedCurriculum }));
        setCurrentCurriculum(updatedCurriculum.id);
        setAnchorEl(null);
    }, [ setCurrentCurriculum ]);

    const onDeleteCallback = useCallback((deletedCurriculumId: GanttCurriculumId) =>
    {
        setCurriculumsData((prev) =>
        {
            const next = { ...prev };
            delete next[ deletedCurriculumId ];
            return next;
        });
        setCurrentCurriculum((previousCurrent) =>
        {
            if (previousCurrent !== deletedCurriculumId)
            {
                return previousCurrent;
            }
            const remainingIds = sortedIds.filter((id) => id !== deletedCurriculumId);
            return remainingIds[ 0 ] ?? null;
        });
        setAnchorEl(null);
    }, [ setCurrentCurriculum, sortedIds ]);

    const handleTogglePanel = useCallback((event: MouseEvent<HTMLButtonElement>) =>
    {
        setAnchorEl((prev) => prev ? null : event.currentTarget);
    }, []);

    const handleClosePanel = useCallback(() =>
    {
        setAnchorEl(null);
    }, []);

    const handleSelectCurriculum = useCallback((value: SetStateAction<GanttCurriculumId | null>) =>
    {
        setCurrentCurriculum(value);
        handleClosePanel();
    }, [ handleClosePanel, setCurrentCurriculum ]);

    const isOpen = Boolean(anchorEl);

    return (
        <>
            <Fab
                aria-label="גאנטים"
                color="primary"
                onClick={ handleTogglePanel }
                sx={ {
                    position: 'fixed',
                    right: 16,
                    bottom: 16,
                    zIndex: (theme) => theme.zIndex.speedDial,
                } }
            >
                <MenuBookIcon />
            </Fab>

            <Popover
                anchorEl={ anchorEl }
                anchorOrigin={ { vertical: 'top', horizontal: 'right' } }
                onClose={ handleClosePanel }
                open={ isOpen }
                slotProps={ {
                    paper: {
                        sx: {
                            width: PANEL_WIDTH,
                            maxHeight: 420,
                            overflow: 'hidden',
                        }
                    }
                } }
                transformOrigin={ { vertical: 'bottom', horizontal: 'left' } }
            >
                <Box sx={ { p: 1, pb: 0 } }>
                    <Typography align="center" variant="h6">
                        גאנטים
                    </Typography>
                    <CurriculumActionItems
                        disabled={ isFetchingDetails }
                        onCreate={ onCreateCallback }
                        onDelete={ onDeleteCallback }
                        onUpdate={ onUpdateCallback }
                        sourceCurriculum={ currentCurriculum ? curriculumsData[ currentCurriculum ] : null }
                    />
                </Box>
                <List sx={ { paddingX: 2, paddingY: 1, overflowY: 'auto', maxHeight: 330 } }>
                    <ListSubheader sx={ { paddingY: 0.5, background: 'transparent' } }>
                        <Typography align="center" color="text.secondary" variant="body2">
                            רשימת גאנטים
                        </Typography>
                    </ListSubheader>
                    <CurriculumListItems
                        currentCurriculum={ currentCurriculum }
                        curriculumsData={ curriculumsData }
                        isFetchingDetails={ isFetchingDetails }
                        setCurrentCurriculum={ handleSelectCurriculum }
                        sortedIds={ sortedIds }
                    />
                </List>
            </Popover>
        </>
    );
}
