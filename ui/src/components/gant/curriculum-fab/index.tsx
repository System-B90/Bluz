import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import CurriculumListItems from "@/components/gant/curriculum-fab/CurriculumListItems";
import { fetchDrawerData, sortCurriculumsByDraftAndUpdatedAt } from "@/components/gant/curriculum-fab/utils";
import
{
    Box,
    Fab,
    List,
    ListSubheader,
    Popover,
    Typography
} from "@mui/material";
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useSnackbar } from 'notistack';
import { Dispatch, MouseEvent, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CurriculumActionItems } from './CurriculumActionItems';

export interface CurriculumDrawerProps
{
    open?: boolean;
    setOpen?: Dispatch<SetStateAction<boolean>>;
    setCurrentCurriculum: Dispatch<SetStateAction<CurriculumId | null>>;
    currentCurriculum?: CurriculumId | null;
}

const PANEL_WIDTH = 300;

export default function CurriculumFab({
    setCurrentCurriculum,
    currentCurriculum,
}: CurriculumDrawerProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const [ curriculumsData, setCurriculumsData ] = useState<Record<CurriculumId, CurriculumDocument>>({} as Record<CurriculumId, CurriculumDocument>);
    const [ isFetchingDetails, setIsFetchingDetails ] = useState<boolean>(true);
    const [ anchorEl, setAnchorEl ] = useState<HTMLButtonElement | null>(null);
    const hasInitializedSelection = useRef(false);

    useEffect(() =>
    {
        let isMounted = true;
        setIsFetchingDetails(true);
        fetchDrawerData({ isMounted, enqueueSnackbar, setCurriculumsData, setIsFetchingDetails });
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

    const onCreateCallback = useCallback((newCurriculum: CurriculumDocument) =>
    {
        setCurrentCurriculum(newCurriculum.id);
        setCurriculumsData((prev) => ({ ...prev, [ newCurriculum.id ]: newCurriculum }));
        setAnchorEl(null);
    }, [ setCurrentCurriculum ]);

    const onUpdateCallback = useCallback((updatedCurriculum: CurriculumDocument) =>
    {
        setCurriculumsData((prev) => ({ ...prev, [ updatedCurriculum.id ]: updatedCurriculum }));
        setCurrentCurriculum(updatedCurriculum.id);
        setAnchorEl(null);
    }, [ setCurrentCurriculum ]);

    const onDeleteCallback = useCallback((deletedCurriculumId: CurriculumId) =>
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

    const handleSelectCurriculum = useCallback((value: SetStateAction<CurriculumId | null>) =>
    {
        setCurrentCurriculum(value);
        handleClosePanel();
    }, [ handleClosePanel, setCurrentCurriculum ]);

    const isOpen = Boolean(anchorEl);

    return (
        <>
            <Fab
                color="primary"
                aria-label="גאנטים"
                onClick={ handleTogglePanel }
                sx={ {
                    position: 'fixed',
                    left: 16,
                    bottom: 16,
                    zIndex: (theme) => theme.zIndex.speedDial,
                } }
            >
                <MenuBookIcon />
            </Fab>

            <Popover
                open={ isOpen }
                anchorEl={ anchorEl }
                onClose={ handleClosePanel }
                anchorOrigin={ { vertical: 'top', horizontal: 'right' } }
                transformOrigin={ { vertical: 'bottom', horizontal: 'left' } }
                slotProps={ {
                    paper: {
                        sx: {
                            width: PANEL_WIDTH,
                            maxHeight: 420,
                            overflow: 'hidden',
                        }
                    }
                } }
            >
                <Box sx={ { p: 1, pb: 0 } }>
                    <Typography variant="h6" align="center">
                        גאנטים
                    </Typography>
                    <CurriculumActionItems
                        disabled={ isFetchingDetails }
                        onCreate={ onCreateCallback }
                        onUpdate={ onUpdateCallback }
                        onDelete={ onDeleteCallback }
                        sourceCurriculum={ currentCurriculum ? curriculumsData[ currentCurriculum ] : null }
                    />
                </Box>
                <List sx={ { paddingX: 2, paddingY: 1, overflowY: 'auto', maxHeight: 330 } }>
                    <ListSubheader sx={ { paddingY: 0.5, background: 'transparent' } }>
                        <Typography variant="body2" color="text.secondary" align="center">
                            רשימת גאנטים
                        </Typography>
                    </ListSubheader>
                    <CurriculumListItems
                        isFetchingDetails={ isFetchingDetails }
                        curriculumsData={ curriculumsData }
                        sortedIds={ sortedIds }
                        setCurrentCurriculum={ handleSelectCurriculum }
                        currentCurriculum={ currentCurriculum }
                    />
                </List>
            </Popover>
        </>
    );
}
