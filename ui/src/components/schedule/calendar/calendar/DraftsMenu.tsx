import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import
{
    apiCreateDraft,
    apiDeleteDraft,
    apiGetDraft,
    apiListDrafts,
    apiUpdateDraft,
} from "@/api-client/calendar-drafts";
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { CalendarDraftSummary } from "@/api-shared/types";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";

/**
 * Toolbar control for server-synced, shared (multi-user) drafts: save the
 * current calendar as a named draft, list everyone's drafts, load one (via a
 * SET_EVENTS dispatch), overwrite one with the current state, or delete it.
 */
export function DraftsMenu()
{
    const { enqueueSnackbar } = useSnackbar();
    const { events, dispatch, iterationId } = useCalendar();

    const [ anchorEl, setAnchorEl ] = useState<HTMLButtonElement | null>(null);
    const [ drafts, setDrafts ] = useState<Array<CalendarDraftSummary>>([]);
    const [ label, setLabel ] = useState("");
    const [ loading, setLoading ] = useState(false);
    const [ busyId, setBusyId ] = useState<null | string>(null);

    const open = Boolean(anchorEl);

    const refresh = useCallback(async () =>
    {
        setLoading(true);
        try
        {
            setDrafts(await apiListDrafts(iterationId));
        } catch (error)
        {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "טעינת הטיוטות נכשלה!",
                error,
            );
        } finally
        {
            setLoading(false);
        }
    }, [ iterationId, enqueueSnackbar ]);

    const handleOpen = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) =>
        {
            setAnchorEl(e.currentTarget);
            void refresh();
        },
        [ refresh ],
    );

    const handleClose = useCallback(() => setAnchorEl(null), []);

    const handleCreate = useCallback(async () =>
    {
        const trimmed = label.trim();
        if (!trimmed) return;
        setLoading(true);
        try
        {
            await apiCreateDraft(trimmed, events, iterationId);
            setLabel("");
            enqueueSnackbar("הטיוטה נשמרה לשרת.", { variant: "success" });
            await refresh();
        } catch (error)
        {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "שמירת הטיוטה נכשלה!",
                error,
            );
        } finally
        {
            setLoading(false);
        }
    }, [ label, events, iterationId, enqueueSnackbar, refresh ]);

    const handleLoad = useCallback(
        async (draftId: string) =>
        {
            setBusyId(draftId);
            try
            {
                const { events: loaded } = await apiGetDraft(
                    draftId,
                    iterationId,
                );
                dispatch({ type: "SET_EVENTS", payload: loaded });
                enqueueSnackbar(
                    `הטיוטה נטענה (${loaded.length} מופעים).`,
                    { variant: "success" },
                );
                handleClose();
            } catch (error)
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת הטיוטה נכשלה!",
                    error,
                );
            } finally
            {
                setBusyId(null);
            }
        },
        [ iterationId, dispatch, enqueueSnackbar, handleClose ],
    );

    const handleOverwrite = useCallback(
        async (draftId: string) =>
        {
            setBusyId(draftId);
            try
            {
                await apiUpdateDraft(draftId, events, iterationId);
                enqueueSnackbar("הטיוטה עודכנה למצב הנוכחי.", {
                    variant: "success",
                });
                await refresh();
            } catch (error)
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון הטיוטה נכשל!",
                    error,
                );
            } finally
            {
                setBusyId(null);
            }
        },
        [ events, iterationId, enqueueSnackbar, refresh ],
    );

    const handleDelete = useCallback(
        async (draftId: string) =>
        {
            setBusyId(draftId);
            try
            {
                await apiDeleteDraft(draftId, iterationId);
                setDrafts((prev) => prev.filter((d) => d.id !== draftId));
            } catch (error)
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "מחיקת הטיוטה נכשלה!",
                    error,
                );
            } finally
            {
                setBusyId(null);
            }
        },
        [ iterationId, enqueueSnackbar ],
    );

    return (
        <>
            <Tooltip title="טיוטות משותפות">
                <Button
                    onClick={ handleOpen }
                    sx={ {
                        minWidth: 38,
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                            color: "primary.main",
                        },
                        "&:active": {
                            transform: "scale(0.95)",
                        },
                    } }
                    variant="outlined"
                >
                    <DriveFileRenameOutlineIcon fontSize="small" />
                </Button>
            </Tooltip>

            <Popover
                anchorEl={ anchorEl }
                anchorOrigin={ { vertical: "bottom", horizontal: "left" } }
                onClose={ handleClose }
                open={ open }
                slotProps={ {
                    paper: { sx: { p: 2, mt: 1, width: 400, borderRadius: 2 } },
                } }
                transformOrigin={ { vertical: "top", horizontal: "left" } }
            >
                <Typography sx={ { fontWeight: 700, mb: 1 } } variant="subtitle1">
                    טיוטות משותפות
                </Typography>

                <Stack direction="row" spacing={ 1 } sx={ { mb: 1 } }>
                    <TextField
                        fullWidth
                        label="שם הטיוטה"
                        onChange={ (e) => setLabel(e.target.value) }
                        onKeyDown={ (e) =>
                        {
                            if (e.key === "Enter") void handleCreate();
                        } }
                        size="small"
                        value={ label }
                    />
                    <Button
                        disabled={ !label.trim() || loading }
                        onClick={ () => void handleCreate() }
                        startIcon={ <SaveIcon /> }
                        sx={{ height: "100%" }}
                        variant="contained"
                    >
                        שמירה
                    </Button>
                </Stack>

                <Divider sx={ { my: 1 } } />

                { loading && drafts.length === 0 ? (
                    <Box sx={ { display: "flex", justifyContent: "center", py: 3 } }>
                        <CircularProgress size={ 24 } />
                    </Box>
                ) : drafts.length === 0 ? (
                    <Typography
                        color="text.secondary"
                        sx={ { py: 2, textAlign: "center" } }
                        variant="body2"
                    >
                        אין טיוטות משותפות.
                    </Typography>
                ) : (
                    <List dense sx={ { maxHeight: 320, overflowY: "auto" } }>
                        { drafts.map((draft) => (
                            <ListItem
                                disableGutters
                                key={ draft.id }
                                secondaryAction={
                                    <Stack direction="row" spacing={ 0.5 }>
                                        <Tooltip title="טעינת טיוטה">
                                            <span>
                                                <IconButton
                                                    disabled={ busyId !== null }
                                                    edge="end"
                                                    onClick={ () =>
                                                        void handleLoad(
                                                            draft.id,
                                                        )
                                                    }
                                                    size="small"
                                                >
                                                    <FolderOpenIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title="עדכון למצב הנוכחי">
                                            <span>
                                                <IconButton
                                                    disabled={ busyId !== null }
                                                    edge="end"
                                                    onClick={ () =>
                                                        void handleOverwrite(
                                                            draft.id,
                                                        )
                                                    }
                                                    size="small"
                                                >
                                                    <SaveIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title="מחיקה">
                                            <span>
                                                <IconButton
                                                    color="error"
                                                    disabled={ busyId !== null }
                                                    edge="end"
                                                    onClick={ () =>
                                                        void handleDelete(
                                                            draft.id,
                                                        )
                                                    }
                                                    size="small"
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Stack>
                                }
                            >
                                <ListItemText
                                    primary={ draft.label }
                                    secondary={ `${draft.updatedBy} · ${dayjs(
                                        draft.updatedAt,
                                    ).format("DD/MM/YYYY HH:mm")} · ${draft.eventCount
                                    } מופעים` }
                                />
                            </ListItem>
                        )) }
                    </List>
                ) }
            </Popover>
        </>
    );
}
