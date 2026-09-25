import LinkOffIcon from "@mui/icons-material/LinkOff";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { Dispatch, SetStateAction, useCallback, useState } from "react";

import {
    GanttCurriculumId,
    GanttSyllabus,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useConfirmDialog } from "@/components/base/UseConfirmDialog";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { ModulesTable } from "@/components/gantt/syllabus-card/ModulesTable";
import { ShufflesSection } from "@/components/gantt/syllabus-dialog/ShufflesSection";
import { SyllabusLinksSection } from "@/components/gantt/syllabus-dialog/SyllabusLinksSection";

export type SyllabusDialogProps = {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    curriculumId: GanttCurriculumId;
    syllabusId: GanttSyllabusId | null;
};

/**
 * One dialog for everything that belongs to a syllabus rather than to a module:
 * its title and description, its שיוך (courses and אחראי מקצוע), its shuffles,
 * its modules, and the unlink action — the three card icons and two separate
 * dialogs these replace made the card a row of unlabeled buttons.
 *
 * Laid out like the module dialog: details on the leading side, the item table
 * on the trailing one.
 */
export function SyllabusDialog({
    open,
    setOpen,
    curriculumId,
    syllabusId,
}: SyllabusDialogProps) {
    const { enqueueSnackbar } = useSnackbar();
    const syllabus = useSyllabus(syllabusId as GanttSyllabusId);
    const { updateSyllabus, unlinkSyllabusFromCurriculum } =
        useSyllabusActions();
    const { confirm, confirmDialog } = useConfirmDialog();

    const [localTitle, setLocalTitle] = useState(syllabus?.title ?? "");
    const [localDescription, setLocalDescription] = useState(
        syllabus?.description ?? "",
    );

    // A single dialog instance serves every card and stays mounted while
    // closed, so the local fields are reset on every open, not only when the
    // syllabus changes: reopening the same syllabus after it was renamed
    // elsewhere would otherwise show the old title, and blurring the field
    // would write it back over the rename.
    const [prevSyllabusId, setPrevSyllabusId] = useState(syllabusId);
    const [prevOpen, setPrevOpen] = useState(open);
    if (syllabusId !== prevSyllabusId || open !== prevOpen) {
        setPrevSyllabusId(syllabusId);
        setPrevOpen(open);
        if (open) {
            setLocalTitle(syllabus?.title ?? "");
            setLocalDescription(syllabus?.description ?? "");
        }
    }

    const titleMissing = localTitle.trim() === "";

    const closeHandler = useCallback(() => setOpen(false), [setOpen]);

    const commit = useCallback(
        (updates: Partial<GanttSyllabus>) => {
            if (!syllabusId || !syllabus) return;

            const changed = Object.entries(updates).some(
                ([key, value]) =>
                    syllabus[key as keyof GanttSyllabus] !== value,
            );
            if (!changed) return;

            updateSyllabus(syllabusId, updates).catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שמירת הסילבוס נכשלה!",
                    error,
                ),
            );
        },
        [syllabusId, syllabus, updateSyllabus, enqueueSnackbar],
    );

    // Unlinking drops the syllabus off this gantt — one stray click on an
    // unlabeled icon used to be enough, so it now confirms first.
    const unlinkHandler = useCallback(async () => {
        if (!syllabusId) return;
        const ok = await confirm(
            `להסיר את הסילבוס "${syllabus?.title ?? ""}" מהגאנט? הסילבוס עצמו יישמר.`,
            { title: "הסרת סילבוס מהגאנט", confirmLabel: "להסיר" },
        );
        if (!ok) return;

        unlinkSyllabusFromCurriculum(curriculumId, syllabusId)
            .then(() => setOpen(false))
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "הסרת הסילבוס מהגאנט נכשלה!",
                    error,
                ),
            );
    }, [
        syllabusId,
        syllabus?.title,
        curriculumId,
        confirm,
        unlinkSyllabusFromCurriculum,
        setOpen,
        enqueueSnackbar,
    ]);

    if (!syllabusId) return null;

    return (
        <Dialog fullWidth maxWidth="lg" onClose={closeHandler} open={open}>
            <DialogTitle sx={{ pb: 1 }}>
                <Stack spacing={0.5}>
                    <Typography
                        component="span"
                        sx={{ fontWeight: "bold" }}
                        variant="h5"
                    >
                        עריכת סילבוס: {syllabus?.title}
                    </Typography>
                    <Typography
                        component="span"
                        sx={{ color: "text.secondary" }}
                        variant="caption"
                    >
                        {`${syllabus?.modules?.length ?? 0} מערכים · ${
                            syllabus?.shuffles?.length ?? 0
                        } שאפלים`}
                    </Typography>
                </Stack>
            </DialogTitle>

            <DialogContent>
                <Box
                    alignItems={{ xs: "stretch", md: "flex-start" }}
                    display="flex"
                    flexDirection={{ xs: "column", md: "row" }}
                    gap={2}
                    mt={1}
                >
                    <Stack spacing={2.5} width={{ xs: "100%", md: "45%" }}>
                        <TextField
                            error={titleMissing}
                            fullWidth
                            helperText={
                                titleMissing
                                    ? "לסילבוס חייב להיות שם. השם הקודם יישמר."
                                    : undefined
                            }
                            label="שם הסילבוס"
                            onBlur={() => {
                                // An empty title leaves the card nameless, so
                                // the field falls back to the saved one.
                                if (titleMissing) {
                                    setLocalTitle(syllabus?.title ?? "");
                                    return;
                                }
                                commit({ title: localTitle.trim() });
                            }}
                            onChange={(e) => setLocalTitle(e.target.value)}
                            required
                            size="small"
                            value={localTitle}
                        />

                        <TextField
                            fullWidth
                            label="תיאור"
                            minRows={4}
                            multiline
                            onBlur={() =>
                                commit({ description: localDescription })
                            }
                            onChange={(e) =>
                                setLocalDescription(e.target.value)
                            }
                            size="small"
                            value={localDescription}
                        />

                        <SyllabusLinksSection syllabusId={syllabusId} />

                        <Divider flexItem>
                            <Typography
                                color="text.secondary"
                                variant="caption"
                            >
                                שאפלים
                            </Typography>
                        </Divider>

                        <ShufflesSection syllabusId={syllabusId} />
                    </Stack>

                    <Divider
                        flexItem
                        orientation="vertical"
                        sx={{ display: { xs: "none", md: "block" } }}
                    />

                    <Stack flexGrow={1} spacing={1}>
                        <Typography
                            sx={{ color: "text.secondary", fontWeight: "bold" }}
                            variant="body2"
                        >
                            מערכים
                        </Typography>
                        <ModulesTable
                            curriculumId={curriculumId}
                            maxHeight="60vh"
                            syllabusId={syllabusId}
                            syllabusModules={syllabus?.modules ?? []}
                        />
                    </Stack>
                </Box>
            </DialogContent>

            <DialogActions>
                <Tooltip title="הסילבוס יישאר במערכת, אך לא יהיה משויך עוד לתוכנית הלימודים">
                    <Button
                        color="warning"
                        onClick={() => void unlinkHandler()}
                        startIcon={<LinkOffIcon fontSize="small" />}
                    >
                        הסרה מהגאנט
                    </Button>
                </Tooltip>
                <Button
                    color="primary"
                    onClick={closeHandler}
                    variant="contained"
                >
                    סגירה
                </Button>
            </DialogActions>
            {confirmDialog}
        </Dialog>
    );
}
