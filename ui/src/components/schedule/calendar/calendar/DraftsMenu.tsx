import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
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
import { CalendarDraftSummary } from "@/api-shared/types";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { CalendarStoreMenu } from "@/components/schedule/calendar/calendar/CalendarStoreMenu";
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

    const [ drafts, setDrafts ] = useState<Array<CalendarDraftSummary>>([]);
    const [ loading, setLoading ] = useState(false);
    const [ busyId, setBusyId ] = useState<null | string>(null);

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

    const handleCreate = useCallback(async (label: string) =>
    {
        setLoading(true);
        try
        {
            await apiCreateDraft(label, events, iterationId);
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
    }, [ events, iterationId, enqueueSnackbar, refresh ]);

    const handleLoad = useCallback(
        async (draftId: string, close: () => void) =>
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
                close();
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
        [ iterationId, dispatch, enqueueSnackbar ],
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
        <CalendarStoreMenu<CalendarDraftSummary>
            actions={ [
                {
                    tooltip: "טעינת טיוטה",
                    icon: <FolderOpenIcon fontSize="small" />,
                    onClick: (draft, close) =>
                        void handleLoad(draft.id, close),
                },
                {
                    tooltip: "עדכון למצב הנוכחי",
                    icon: <SaveIcon fontSize="small" />,
                    onClick: (draft) => void handleOverwrite(draft.id),
                },
                {
                    tooltip: "מחיקה",
                    icon: <DeleteOutlineIcon fontSize="small" />,
                    color: "error",
                    onClick: (draft) => void handleDelete(draft.id),
                },
            ] }
            busyId={ busyId }
            createIcon={ <SaveIcon /> }
            createLabel="שמירה"
            disabled
            disabledTooltip="טיוטות משותפות — בקרוב"
            emptyText="אין טיוטות משותפות."
            entries={ drafts }
            icon={ <DriveFileRenameOutlineIcon fontSize="small" /> }
            loading={ loading }
            nameLabel="שם הטיוטה"
            onCreate={ handleCreate }
            onRefresh={ refresh }
            renderEntry={ (draft) => ({
                primary: draft.label,
                secondary: `${draft.updatedBy} · ${dayjs(draft.updatedAt).format(
                    "DD/MM/YYYY HH:mm",
                )} · ${draft.eventCount} מופעים`,
            }) }
            title="טיוטות משותפות"
            tooltip="טיוטות משותפות"
        />
    );
}
