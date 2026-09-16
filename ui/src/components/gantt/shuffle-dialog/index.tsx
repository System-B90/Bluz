import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import GroupsIcon from "@mui/icons-material/Groups";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { ShuffleUsages } from "@/api-shared/types/gantt/shuffles";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { ShuffleDeleteDialog } from "@/components/gantt/shuffle-dialog/ShuffleDeleteDialog";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { useCurriculumProviderActions, useCurriculumState } from "@/components/gantt/state/provider";

const NO_USAGES: ShuffleUsages = { events: [], modules: [] };

export type ShuffleDialogProps = {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    syllabusId: GanttSyllabusId | null;
};

type PendingDeletion = {
    removed: Array<string>;
    shuffles: Array<string>;
    usages: ShuffleUsages;
};

/** How many of the syllabus' modules and events carry each shuffle name. */
function useShuffleTagCounts(syllabusId: GanttSyllabusId | null) {
    const state = useCurriculumState();

    return useMemo(() => {
        const counts: Record<string, number> = {};
        const bump = (names: Array<string> | undefined) => {
            for (const name of names ?? []) {
                counts[name] = (counts[name] ?? 0) + 1;
            }
        };

        if (!syllabusId) return counts;
        for (const moduleId of state.syllabuses[syllabusId]?.modules ?? []) {
            const moduleDoc = state.modules[moduleId];
            if (!moduleDoc) continue;
            bump(moduleDoc.shuffles);
            for (const eventId of moduleDoc.events ?? []) {
                bump(state.events[eventId]?.shuffles);
            }
        }
        return counts;
    }, [syllabusId, state]);
}

/**
 * The syllabus' shuffles (student groups), managed on their own instead of in
 * the chip field that used to sit on the syllabus card (#699).
 *
 * Shuffles stay per-syllabus: the names defined here are what the module and
 * event dialogs offer as tags, and what an event's shuffle group splits across.
 * Deleting a name that modules or events still use goes through a confirmation
 * that lists them and cascades the removal (#485) — otherwise those items keep
 * a dangling name the UI cannot clear.
 */
export function ShuffleDialog({ open, setOpen, syllabusId }: ShuffleDialogProps) {
    const { enqueueSnackbar } = useSnackbar();
    const syllabus = useSyllabus(syllabusId as GanttSyllabusId);
    const { updateSyllabus } = useSyllabusActions();
    const { dispatch } = useCurriculumProviderActions();
    const tagCounts = useShuffleTagCounts(syllabusId);

    const [draft, setDraft] = useState("");
    const [pending, setPending] = useState<null | PendingDeletion>(null);

    const shuffles = useMemo(() => syllabus?.shuffles ?? [], [syllabus?.shuffles]);

    // The dialog outlives its own close (one instance per gantt), so a
    // half-typed name is cleared on reopen rather than in an effect.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setDraft("");
    }

    const closeHandler = useCallback(() => setOpen(false), [setOpen]);

    const commit = useCallback(
        (next: Array<string>) => {
            if (!syllabusId) return;
            updateSyllabus(syllabusId, { shuffles: next }).catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון השאפלים נכשל!",
                    error,
                ),
            );
        },
        [syllabusId, updateSyllabus, enqueueSnackbar],
    );

    const addHandler = useCallback(() => {
        const name = draft.trim();
        if (!name) return;
        if (shuffles.includes(name)) {
            enqueueSnackbar("שאפל בשם הזה כבר קיים במקצוע.", {
                variant: "warning",
            });
            return;
        }

        setDraft("");
        commit([...shuffles, name]);
    }, [draft, shuffles, commit, enqueueSnackbar]);

    const removeHandler = useCallback(
        (name: string) => {
            if (!syllabusId) return;
            const next = shuffles.filter((shuffle) => shuffle !== name);

            ganttApi
                .getShuffleUsages(syllabusId, [name])
                .then((usages) => {
                    if (usages.modules.length + usages.events.length > 0) {
                        setPending({
                            removed: [name],
                            shuffles: next,
                            usages,
                        });
                        return;
                    }
                    commit(next);
                })
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "בדיקת השימוש בשאפל נכשלה!",
                        error,
                    ),
                );
        },
        [syllabusId, shuffles, commit, enqueueSnackbar],
    );

    const confirmDeletionHandler = useCallback(() => {
        if (!pending || !syllabusId) return;
        const { removed, shuffles: next, usages } = pending;
        setPending(null);

        const strip = (names: Array<string>) =>
            names.filter((name) => !removed.includes(name));

        ganttApi
            .applyShuffles(syllabusId, next)
            .then(() => {
                // The server stripped the names in the same transaction, so
                // mirror it locally instead of refetching the whole gantt.
                for (const usedModule of usages.modules) {
                    dispatch({
                        type: "UPDATE_MODULE",
                        payload: {
                            id: usedModule.id,
                            updates: { shuffles: strip(usedModule.shuffles) },
                        },
                    });
                }
                for (const event of usages.events) {
                    dispatch({
                        type: "UPDATE_EVENT",
                        payload: {
                            id: event.id,
                            updates: { shuffles: strip(event.shuffles) },
                        },
                    });
                }
                dispatch({
                    type: "UPDATE_SYLLABUS",
                    payload: { id: syllabusId, updates: { shuffles: next } },
                });
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "מחיקת השאפלים נכשלה!",
                    error,
                ),
            );
    }, [pending, syllabusId, dispatch, enqueueSnackbar]);

    return (
        <Dialog fullWidth maxWidth="sm" onClose={closeHandler} open={open}>
            <DialogTitle>
                <Stack alignItems="center" direction="row" gap={1}>
                    <GroupsIcon color="action" />
                    <Box>
                        שאפלים
                        {syllabus ? (
                            <Typography color="text.secondary" variant="body2">
                                {syllabus.title}
                            </Typography>
                        ) : null}
                    </Box>
                </Stack>
            </DialogTitle>
            <DialogContent>
                <Stack gap={2} pt={1}>
                    <Alert severity="info">
                        השאפלים שייכים למקצוע. מערכים ומופעים מתויגים בשאפלים
                        האלה, ומופע יחיד יכול להתפצל לקבוצה — מופע לכל שאפל,
                        באותו שם ובזמנים שונים.
                    </Alert>

                    <Stack alignItems="flex-start" direction="row" gap={1}>
                        <TextField
                            autoFocus
                            fullWidth
                            label="שם השאפל"
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                addHandler();
                            }}
                            size="small"
                            value={draft}
                        />
                        <Button
                            disabled={!draft.trim()}
                            onClick={addHandler}
                            startIcon={<AddIcon fontSize="small" />}
                            sx={{ flexShrink: 0, mt: 0.25 }}
                            variant="contained"
                        >
                            הוספה
                        </Button>
                    </Stack>

                    {shuffles.length === 0 ? (
                        <Typography color="text.secondary" variant="body2">
                            לא הוגדרו שאפלים במקצוע.
                        </Typography>
                    ) : (
                        <List dense disablePadding>
                            {shuffles.map((name) => (
                                <ListItem
                                    disableGutters
                                    key={name}
                                    secondaryAction={
                                        <Tooltip title="מחיקת שאפל">
                                            <IconButton
                                                color="error"
                                                edge="end"
                                                onClick={() => removeHandler(name)}
                                                size="small"
                                            >
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    }
                                >
                                    <ListItemText primary={name} />
                                    <Chip
                                        label={`${tagCounts[name] ?? 0} פריטים`}
                                        size="small"
                                        sx={{ marginInlineEnd: 5 }}
                                        variant="outlined"
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={closeHandler}>סגירה</Button>
            </DialogActions>

            <ShuffleDeleteDialog
                onCancel={() => setPending(null)}
                onConfirm={confirmDeletionHandler}
                open={pending !== null}
                removed={pending?.removed ?? []}
                usages={pending?.usages ?? NO_USAGES}
            />
        </Dialog>
    );
}
