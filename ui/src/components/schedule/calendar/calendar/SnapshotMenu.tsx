import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HistoryIcon from "@mui/icons-material/History";
import RestoreIcon from "@mui/icons-material/Restore";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import
{
    apiCreateSnapshot,
    apiDeleteSnapshot,
    apiGetSnapshot,
    apiListSnapshots,
    apiRestoreSnapshot,
} from "@/api-client/calendar-snapshots";
import { CalendarSnapshotSummary } from "@/api-shared/types";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { CalendarStoreMenu } from "@/components/schedule/calendar/calendar/CalendarStoreMenu";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { Event } from "@/components/schedule/types/event";

/** A restore that is pending user confirmation because the snapshot's events
 *  fall outside the currently viewed calendar range. */
type PendingRestore = {
    snapshotId: string;
    events: Array<Event>;
    rangeStart: Date;
    rangeEnd: Date;
    close: () => void;
};

/**
 * Toolbar control for git-tag-like calendar snapshots: create a named restore
 * point from the current calendar, list existing ones, restore one (via a
 * SET_EVENTS dispatch), or delete one.
 */
export function SnapshotMenu()
{
    const { enqueueSnackbar } = useSnackbar();
    const {
        events,
        dispatch,
        iterationId,
        startDate,
        endDate,
        setStartDate,
        setEndDate,
    } = useCalendar();

    const [ snapshots, setSnapshots ] = useState<Array<CalendarSnapshotSummary>>(
        [],
    );
    const [ loading, setLoading ] = useState(false);
    const [ busyId, setBusyId ] = useState<null | string>(null);
    const [ pendingRestore, setPendingRestore ] =
        useState<null | PendingRestore>(null);

    const refresh = useCallback(async () =>
    {
        setLoading(true);
        try
        {
            setSnapshots(await apiListSnapshots(iterationId));
        } catch (error)
        {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "טעינת צילומי המצב נכשלה!",
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
            await apiCreateSnapshot(label, events, iterationId);
            enqueueSnackbar("צילום המצב נשמר בהצלחה.", { variant: "success" });
            await refresh();
        } catch (error)
        {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "שמירת צילום המצב נכשלה!",
                error,
            );
        } finally
        {
            setLoading(false);
        }
    }, [ events, iterationId, enqueueSnackbar, refresh ]);

    /** Runs the server-side restore and syncs the local view. */
    const performRestore = useCallback(
        async (
            snapshotId: string,
            restored: Array<Event>,
            close: () => void,
        ) =>
        {
            setBusyId(snapshotId);
            try
            {
                const result = await apiRestoreSnapshot(
                    snapshotId,
                    iterationId,
                );
                dispatch({ type: "SET_EVENTS", payload: restored });
                enqueueSnackbar(
                    `המצב שוחזר (${result.restoredCount} מופעים).`,
                    { variant: "success" },
                );
                close();
            } catch (error)
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שחזור המצב נכשל!",
                    error,
                );
            } finally
            {
                setBusyId(null);
            }
        },
        [ iterationId, dispatch, enqueueSnackbar ],
    );

    const handleRestore = useCallback(
        async (snapshotId: string, close: () => void) =>
        {
            setBusyId(snapshotId);
            try
            {
                const { events: restored } = await apiGetSnapshot(
                    snapshotId,
                    iterationId,
                );
                if (restored.length === 0)
                {
                    enqueueSnackbar("צילום המצב ריק — אין מה לשחזר.", {
                        variant: "warning",
                    });
                    return;
                }

                const rangeStart = new Date(
                    Math.min(...restored.map((e) => e.startTime.valueOf())),
                );
                const rangeEnd = new Date(
                    Math.max(...restored.map((e) => e.endTime.valueOf())),
                );
                // Warn before restoring events that fall outside the range the
                // user is currently looking at — they would not see the effect.
                const outOfView =
                    !startDate ||
                    !endDate ||
                    rangeStart < startDate ||
                    rangeEnd > endDate;
                if (outOfView)
                {
                    setPendingRestore({
                        snapshotId,
                        events: restored,
                        rangeStart,
                        rangeEnd,
                        close,
                    });
                    return;
                }

                await performRestore(snapshotId, restored, close);
            } catch (error)
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שחזור המצב נכשל!",
                    error,
                );
            } finally
            {
                setBusyId(null);
            }
        },
        [
            iterationId,
            startDate,
            endDate,
            performRestore,
            enqueueSnackbar,
        ],
    );

    /** User confirmed an out-of-view restore: jump the view to the snapshot's
     *  range, then restore. */
    const handleConfirmPendingRestore = useCallback(async () =>
    {
        if (!pendingRestore) return;
        const { snapshotId, events: restored, rangeStart, rangeEnd, close } =
            pendingRestore;
        setPendingRestore(null);
        setStartDate(dayjs(rangeStart).startOf("day").toDate());
        setEndDate(dayjs(rangeEnd).endOf("day").toDate());
        await performRestore(snapshotId, restored, close);
    }, [ pendingRestore, setStartDate, setEndDate, performRestore ]);

    const handleDelete = useCallback(
        async (snapshotId: string) =>
        {
            setBusyId(snapshotId);
            try
            {
                await apiDeleteSnapshot(snapshotId, iterationId);
                setSnapshots((prev) =>
                    prev.filter((s) => s.id !== snapshotId),
                );
            } catch (error)
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "מחיקת צילום המצב נכשלה!",
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
        <CalendarStoreMenu<CalendarSnapshotSummary>
            actions={ [
                {
                    tooltip: "שחזור",
                    icon: <RestoreIcon fontSize="small" />,
                    onClick: (snap, close) =>
                        void handleRestore(snap.id, close),
                },
                {
                    tooltip: "מחיקה",
                    icon: <DeleteOutlineIcon fontSize="small" />,
                    color: "error",
                    onClick: (snap) => void handleDelete(snap.id),
                },
            ] }
            busyId={ busyId }
            createIcon={ <AddAPhotoIcon /> }
            createLabel="יצירה"
            disabled
            disabledTooltip="צילומי מצב — בקרוב"
            emptyText="אין צילומי מצב שמורים."
            entries={ snapshots }
            icon={ <HistoryIcon fontSize="small" /> }
            loading={ loading }
            nameLabel="שם נקודת שחזור"
            onCreate={ handleCreate }
            onRefresh={ refresh }
            renderEntry={ (snap) => ({
                primary: snap.label,
                secondary: `${dayjs(snap.createdAt).format(
                    "DD/MM/YYYY HH:mm",
                )} · ${snap.eventCount} מופעים`,
            }) }
            title="צילומי מצב"
            tooltip="צילומי מצב (נקודות שחזור)"
        >
            <Dialog
                onClose={ () => setPendingRestore(null) }
                open={ pendingRestore !== null }
            >
                <DialogTitle>שחזור מחוץ לטווח הנוכחי</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        { pendingRestore ? `המופעים בצילום המצב שייכים לטווח ${dayjs(
                            pendingRestore.rangeStart,
                        ).format("DD/MM/YYYY")} – ${dayjs(
                            pendingRestore.rangeEnd,
                        ).format(
                            "DD/MM/YYYY",
                        )}, שאינו מוצג כעת. לעבור לטווח הזה ולשחזר?` : null }
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={ () => setPendingRestore(null) }>
                        ביטול
                    </Button>
                    <Button
                        onClick={ () => void handleConfirmPendingRestore() }
                        variant="contained"
                    >
                        עבור לטווח ושחזר
                    </Button>
                </DialogActions>
            </Dialog>
        </CalendarStoreMenu>
    );
}
