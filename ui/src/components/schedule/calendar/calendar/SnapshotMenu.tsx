import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HistoryIcon from "@mui/icons-material/History";
import RestoreIcon from "@mui/icons-material/Restore";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
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
    apiCreateSnapshot,
    apiDeleteSnapshot,
    apiGetSnapshot,
    apiListSnapshots,
    apiRestoreSnapshot,
} from "@/api-client/calendar-snapshots";
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { CalendarSnapshotSummary } from "@/api-shared/types";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { Event } from "@/components/schedule/types/event";

/** A restore that is pending user confirmation because the snapshot's events
 *  fall outside the currently viewed calendar range. */
type PendingRestore = {
    snapshotId: string;
    events: Array<Event>;
    rangeStart: Date;
    rangeEnd: Date;
};

/**
 * Toolbar control for git-tag-like calendar snapshots: create a named restore
 * point from the current calendar, list existing ones, restore one (via a
 * SET_EVENTS dispatch), or delete one.
 */
export function SnapshotMenu() {
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

    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [snapshots, setSnapshots] = useState<Array<CalendarSnapshotSummary>>(
        [],
    );
    const [label, setLabel] = useState("");
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState<null | string>(null);
    const [pendingRestore, setPendingRestore] =
        useState<null | PendingRestore>(null);

    const open = Boolean(anchorEl);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setSnapshots(await apiListSnapshots(iterationId));
        } catch (error) {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "טעינת צילומי המצב נכשלה!",
                error,
            );
        } finally {
            setLoading(false);
        }
    }, [iterationId, enqueueSnackbar]);

    const handleOpen = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            setAnchorEl(e.currentTarget);
            void refresh();
        },
        [refresh],
    );

    const handleClose = useCallback(() => setAnchorEl(null), []);

    const handleCreate = useCallback(async () => {
        const trimmed = label.trim();
        if (!trimmed) return;
        setLoading(true);
        try {
            await apiCreateSnapshot(trimmed, events, iterationId);
            setLabel("");
            enqueueSnackbar("צילום המצב נשמר בהצלחה.", { variant: "success" });
            await refresh();
        } catch (error) {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "שמירת צילום המצב נכשלה!",
                error,
            );
        } finally {
            setLoading(false);
        }
    }, [label, events, iterationId, enqueueSnackbar, refresh]);

    /** Runs the server-side restore and syncs the local view. */
    const performRestore = useCallback(
        async (snapshotId: string, restored: Array<Event>) => {
            setBusyId(snapshotId);
            try {
                const result = await apiRestoreSnapshot(
                    snapshotId,
                    iterationId,
                );
                dispatch({ type: "SET_EVENTS", payload: restored });
                enqueueSnackbar(
                    `המצב שוחזר (${result.restoredCount} מופעים).`,
                    { variant: "success" },
                );
                handleClose();
            } catch (error) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שחזור המצב נכשל!",
                    error,
                );
            } finally {
                setBusyId(null);
            }
        },
        [iterationId, dispatch, enqueueSnackbar, handleClose],
    );

    const handleRestore = useCallback(
        async (snapshotId: string) => {
            setBusyId(snapshotId);
            try {
                const { events: restored } = await apiGetSnapshot(
                    snapshotId,
                    iterationId,
                );
                if (restored.length === 0) {
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
                if (outOfView) {
                    setPendingRestore({
                        snapshotId,
                        events: restored,
                        rangeStart,
                        rangeEnd,
                    });
                    return;
                }

                await performRestore(snapshotId, restored);
            } catch (error) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שחזור המצב נכשל!",
                    error,
                );
            } finally {
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
    const handleConfirmPendingRestore = useCallback(async () => {
        if (!pendingRestore) return;
        const { snapshotId, events: restored, rangeStart, rangeEnd } =
            pendingRestore;
        setPendingRestore(null);
        setStartDate(dayjs(rangeStart).startOf("day").toDate());
        setEndDate(dayjs(rangeEnd).endOf("day").toDate());
        await performRestore(snapshotId, restored);
    }, [pendingRestore, setStartDate, setEndDate, performRestore]);

    const handleDelete = useCallback(
        async (snapshotId: string) => {
            setBusyId(snapshotId);
            try {
                await apiDeleteSnapshot(snapshotId, iterationId);
                setSnapshots((prev) =>
                    prev.filter((s) => s.id !== snapshotId),
                );
            } catch (error) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "מחיקת צילום המצב נכשלה!",
                    error,
                );
            } finally {
                setBusyId(null);
            }
        },
        [iterationId, enqueueSnackbar],
    );

    return (
        <>
            <Tooltip title="צילומי מצב (נקודות שחזור)">
                <IconButton
                    aria-label="צילומי מצב"
                    onClick={handleOpen}
                    size="small"
                    sx={{
                        color: "text.secondary",
                        "&:hover": { color: "primary.main" },
                    }}
                >
                    <HistoryIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Popover
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                onClose={handleClose}
                open={open}
                slotProps={{
                    paper: { sx: { p: 2, mt: 1, width: 360, borderRadius: 2 } },
                }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
            >
                <Typography sx={{ fontWeight: 700, mb: 1 }} variant="subtitle1">
                    צילומי מצב
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <TextField
                        fullWidth
                        label="שם נקודת שחזור"
                        onChange={(e) => setLabel(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void handleCreate();
                        }}
                        size="small"
                        value={label}
                    />
                    <Button
                        disabled={!label.trim() || loading}
                        onClick={() => void handleCreate()}
                        variant="contained"
                    >
                        יצירה
                    </Button>
                </Stack>

                <Divider sx={{ my: 1 }} />

                {loading && snapshots.length === 0 ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : snapshots.length === 0 ? (
                    <Typography
                        color="text.secondary"
                        sx={{ py: 2, textAlign: "center" }}
                        variant="body2"
                    >
                        אין צילומי מצב שמורים.
                    </Typography>
                ) : (
                    <List dense sx={{ maxHeight: 320, overflowY: "auto" }}>
                        {snapshots.map((snap) => (
                            <ListItem
                                disableGutters
                                key={snap.id}
                                secondaryAction={
                                    <Stack direction="row" spacing={0.5}>
                                        <Tooltip title="שחזר">
                                            <span>
                                                <IconButton
                                                    disabled={busyId !== null}
                                                    edge="end"
                                                    onClick={() =>
                                                        void handleRestore(
                                                            snap.id,
                                                        )
                                                    }
                                                    size="small"
                                                >
                                                    <RestoreIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title="מחיקה">
                                            <span>
                                                <IconButton
                                                    color="error"
                                                    disabled={busyId !== null}
                                                    edge="end"
                                                    onClick={() =>
                                                        void handleDelete(
                                                            snap.id,
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
                                    primary={snap.label}
                                    secondary={`${dayjs(snap.createdAt).format(
                                        "DD/MM/YYYY HH:mm",
                                    )} · ${snap.eventCount} מופעים`}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Popover>

            <Dialog
                onClose={() => setPendingRestore(null)}
                open={pendingRestore !== null}
            >
                <DialogTitle>שחזור מחוץ לטווח הנוכחי</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {pendingRestore &&
                            `המופעים בצילום המצב שייכים לטווח ${dayjs(
                                pendingRestore.rangeStart,
                            ).format("DD/MM/YYYY")} – ${dayjs(
                                pendingRestore.rangeEnd,
                            ).format(
                                "DD/MM/YYYY",
                            )}, שאינו מוצג כעת. לעבור לטווח הזה ולשחזר?`}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPendingRestore(null)}>
                        ביטול
                    </Button>
                    <Button
                        onClick={() => void handleConfirmPendingRestore()}
                        variant="contained"
                    >
                        עבור לטווח ושחזר
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
