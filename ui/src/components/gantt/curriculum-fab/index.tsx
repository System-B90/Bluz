import MenuBookIcon from "@mui/icons-material/MenuBook";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import List from "@mui/material/List";
import ListSubheader from "@mui/material/ListSubheader";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import {
    Dispatch,
    MouseEvent,
    SetStateAction,
    useCallback,
    useEffect,
    useState,
} from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GANTT_ANCHORS } from "@/components/app-onboarding/anchors";
import { CurriculumActionItems } from "@/components/gantt/curriculum-fab/CurriculumActionItems";
import { CurriculumListItems } from "@/components/gantt/curriculum-fab/CurriculumListItems";
import { useCurriculumList } from "@/components/gantt/state/curriculum-list";
import { useTourAnchor } from "@/components/onboarding";

export type CurriculumDrawerProps = {
    open?: boolean;
    setOpen?: Dispatch<SetStateAction<boolean>>;
    setCurrentCurriculum?: Dispatch<SetStateAction<GanttCurriculumId | null>>;
    currentCurriculum?: GanttCurriculumId | null;
    onLoadingChange?: (isFetchingDetails: boolean) => void;
};

const PANEL_WIDTH = 320;

export function CurriculumFab({
    setCurrentCurriculum: propSetCurrentCurriculum,
    currentCurriculum: propCurrentCurriculum,
    onLoadingChange,
}: CurriculumDrawerProps) {
    const listState = useCurriculumList();
    const curriculumsData = listState.curriculums;
    const isFetchingDetails = listState.isLoading;
    const groups = listState.groups;
    const currentCurriculum =
        propCurrentCurriculum !== undefined
            ? propCurrentCurriculum
            : listState.currentCurriculum;
    const setCurrentCurriculum =
        propSetCurrentCurriculum ?? listState.setCurrentCurriculum;

    const [ anchorEl, setAnchorEl ] = useState<HTMLButtonElement | null>(null);
    const curriculumFabAnchor = useTourAnchor<HTMLButtonElement>(
        GANTT_ANCHORS.curriculumFab,
    );

    useEffect(() => {
        onLoadingChange?.(isFetchingDetails);
    }, [ isFetchingDetails, onLoadingChange ]);

    const handleTogglePanel = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            setAnchorEl((prev) => (prev ? null : event.currentTarget));
        },
        [],
    );

    const handleClosePanel = useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleSelectCurriculum = useCallback(
        (value: SetStateAction<GanttCurriculumId | null>) => {
            setCurrentCurriculum(value);
            handleClosePanel();
        },
        [ handleClosePanel, setCurrentCurriculum ],
    );

    const handleCreate = useCallback(
        (newCurriculum: GanttCurriculumDocument) => {
            listState.onCreate(newCurriculum);
            handleClosePanel();
        },
        [ handleClosePanel, listState ],
    );

    const handleDelete = useCallback(
        (deletedCurriculumId: GanttCurriculumId) => {
            listState.onDelete(deletedCurriculumId);
            handleClosePanel();
        },
        [ handleClosePanel, listState ],
    );

    const isOpen = Boolean(anchorEl);

    return (
        <>
            <Fab
                aria-label="גאנטים"
                color="primary"
                onClick={ handleTogglePanel }
                ref={ curriculumFabAnchor }
                sx={ {
                    position: "fixed",
                    insetInlineEnd: 16,
                    bottom: 16,
                    zIndex: (theme) => theme.zIndex.speedDial,
                    transition:
                        "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease",
                    "&:hover": {
                        transform: "scale(1.12) rotate(6deg)",
                        boxShadow: "0 10px 20px rgba(0, 0, 0, 0.2)",
                    },
                    "&:active": {
                        transform: "scale(0.92)",
                    },
                } }
            >
                <MenuBookIcon />
            </Fab>

            <Popover
                anchorEl={ anchorEl }
                anchorOrigin={ { vertical: "top", horizontal: "right" } }
                onClose={ handleClosePanel }
                open={ isOpen }
                slotProps={ {
                    paper: {
                        className: "animate-slide-up-fade",
                        sx: {
                            width: PANEL_WIDTH,
                            maxHeight: "min(480px, calc(100vh - 96px))",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            borderRadius: "12px",
                            // Cancel MUI's dark-mode elevation overlay so the flat
                            // background.paper color used by ListSubheader (which has
                            // no overlay of its own) matches the panel exactly.
                            backgroundImage: "none",
                            boxShadow:
                                "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                        },
                    },
                } }
                transformOrigin={ { vertical: "bottom", horizontal: "left" } }
            >
                <Box sx={ { p: 1, pb: 0, flexShrink: 0 } }>
                    <Typography align="center" variant="h6">
                        גאנטים
                    </Typography>
                    <CurriculumActionItems
                        disabled={ isFetchingDetails }
                        onCreate={ handleCreate }
                        onDelete={ handleDelete }
                        sourceCurriculum={
                            currentCurriculum
                                ? curriculumsData[ currentCurriculum ]
                                : null
                        }
                    />
                </Box>
                <List
                    dense
                    sx={ {
                        paddingX: 1,
                        paddingY: 0.5,
                        overflowY: "auto",
                        flexGrow: 1,
                        minHeight: 0,
                    } }
                >
                    <ListSubheader
                        sx={ {
                            paddingY: 0,
                            lineHeight: 1.75,
                            bgcolor: "background.paper",
                        } }
                    >
                        <Typography
                            align="center"
                            color="text.secondary"
                            variant="body2"
                        >
                            רשימת גאנטים
                        </Typography>
                    </ListSubheader>
                    <CurriculumListItems
                        currentCurriculum={ currentCurriculum }
                        curriculumsData={ curriculumsData }
                        groups={ groups }
                        isFetchingDetails={ isFetchingDetails }
                        onCreate={ handleCreate }
                        onDelete={ handleDelete }
                        setCurrentCurriculum={ handleSelectCurriculum }
                    />
                </List>
            </Popover>
        </>
    );
}
