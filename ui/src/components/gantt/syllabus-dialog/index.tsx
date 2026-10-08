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
import { Dispatch, SetStateAction, useCallback, useRef, useState } from "react";

import {
    GanttCurriculumId,
    GanttSyllabus,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { SaveStatusIndicator, useSaveStatus } from "@/components/base/SaveStatus";
import { useConfirmDialog } from "@/components/base/UseConfirmDialog";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { ModulesTable } from "@/components/gantt/syllabus-card/ModulesTable";
import { ShufflesSection } from "@/components/gantt/syllabus-dialog/ShufflesSection";
import { SyllabusImportExportButton } from "@/components/gantt/syllabus-dialog/SyllabusImportExportButton";
import { SyllabusLinksSection } from "@/components/gantt/syllabus-dialog/SyllabusLinksSection";
import { ColorPickerField } from "@/components/schedule/event-dialog/ColorPickerField";

export const UNLINK_HINT = "הסילבוס יישאר במערכת, אך לא יהיה משויך עוד לתוכנית הלימודים";
export const DRAFT_TITLE = "סילבוס חדש";
export const DRAFT_NAME_HINT = "הסילבוס ייווצר כשתאשרו את השם (Enter או מעבר לשדה הבא)";
export const DRAFT_SECTIONS_HINT = "אחרי שהסילבוס ייווצר יהיה אפשר לשייך אותו, להוסיף שאפלים ומערכים.";

export type SyllabusDialogProps = {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
    curriculumId: GanttCurriculumId;
    syllabusId: GanttSyllabusId | null;
    /**
     * A module/event dialog is open on top. The dialog then hides entirely
     * (#884) and stays mounted, so it comes back as it was when the top layer
     * closes. Before #884 it only hid its destructive action (#834).
     */
    covered?: boolean;
    /**
     * Open on a syllabus that doesn't exist yet (#881). Nothing is saved until
     * the name is committed; then the syllabus is created and the dialog
     * carries on editing it through `onDraftCreated`.
     */
    draft?: boolean;
    onDraftCreated?: (syllabusId: GanttSyllabusId) => void;
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
    covered = false,
    draft = false,
    onDraftCreated,
}: SyllabusDialogProps) {
    const { enqueueSnackbar } = useSnackbar();
    const syllabus = useSyllabus(syllabusId as GanttSyllabusId);
    const { createSyllabus, updateSyllabus, unlinkSyllabusFromCurriculum } =
        useSyllabusActions();
    const isDraft = draft && !syllabusId;
    // The ref guards against Enter plus the blur it causes (both run before a
    // re-render); the state disables closing while the create is in flight.
    const creatingDraftRef = useRef(false);
    const [creatingDraft, setCreatingDraft] = useState(false);
    const { confirm, confirmDialog } = useConfirmDialog();
    const { status: saveStatus, track: trackSave, reset: resetSaveStatus } = useSaveStatus();

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
        // A draft that just got created keeps what was typed into it; the
        // store may not hold the new record's fields on this very render.
        const draftJustCreated = open === prevOpen && prevSyllabusId === null;
        setPrevSyllabusId(syllabusId);
        setPrevOpen(open);
        if (open && !draftJustCreated) {
            setLocalTitle(syllabus?.title ?? "");
            setLocalDescription(syllabus?.description ?? "");
            resetSaveStatus();
        }
    }

    const titleMissing = localTitle.trim() === "";
    // A draft starts empty on purpose; only a saved syllabus can lose its name.
    const showTitleError = titleMissing && !isDraft;

    // A cancel while the draft is being created would still end with a new
    // syllabus, so closing waits for the create to settle.
    const closeHandler = useCallback(() => {
        if (!creatingDraft) setOpen(false);
    }, [creatingDraft, setOpen]);

    // The first committed name creates the syllabus (#881). Guarded so Enter
    // followed by the blur it causes creates one record, not two.
    const createFromDraft = useCallback(() => {
        const title = localTitle.trim();
        if (!isDraft || !title || creatingDraftRef.current) return;
        creatingDraftRef.current = true;
        setCreatingDraft(true);
        const description = localDescription.trim();
        trackSave(createSyllabus(title, curriculumId))
            .then((created) => {
                if (!created) {
                    enqueueSnackbar("יצירת הסילבוס נכשלה!", { variant: "error" });
                    return;
                }
                // Leave draft mode the moment the record exists, so nothing
                // after this point can create it a second time.
                onDraftCreated?.(created.id);
                // The title swap isn't announced; the snackbar is (role=alert).
                enqueueSnackbar("נוצר סילבוס חדש", { variant: "success" });
                if (!description) return;
                trackSave(updateSyllabus(created.id, { description })).catch((error) =>
                    enqueueApiErrorSnackbar(enqueueSnackbar, "שמירת תיאור הסילבוס נכשלה!", error),
                );
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "יצירת הסילבוס נכשלה!", error),
            )
            .finally(() => {
                creatingDraftRef.current = false;
                setCreatingDraft(false);
            });
    }, [
        isDraft,
        localTitle,
        localDescription,
        trackSave,
        createSyllabus,
        curriculumId,
        updateSyllabus,
        onDraftCreated,
        enqueueSnackbar,
    ]);

    const commit = useCallback(
        (updates: Partial<GanttSyllabus>) => {
            if (!syllabusId || !syllabus) return;

            const changed = Object.entries(updates).some(
                ([key, value]) =>
                    syllabus[key as keyof GanttSyllabus] !== value,
            );
            if (!changed) return;

            // Fields save on blur; the title-row status says so (#836).
            trackSave(updateSyllabus(syllabusId, updates)).catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שמירת הסילבוס נכשלה!",
                    error,
                ),
            );
        },
        [syllabusId, syllabus, updateSyllabus, enqueueSnackbar, trackSave],
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

    if (!syllabusId && !isDraft) return null;

    // In a draft only the name and description exist; the rest needs an id.
    const draftHint = (
        <Typography color="text.secondary" variant="body2">
            {DRAFT_SECTIONS_HINT}
        </Typography>
    );

    // Only the top layer shows (#884); a covered dialog hides but stays mounted.
    const isTopLayer: boolean = open && !covered;

    return (
        // One layer at a time (#884): a module or event dialog opened from
        // here replaces it on screen; it stays mounted and comes back on close.
        <Dialog
            fullWidth
            keepMounted={covered}
            maxWidth="lg"
            onClose={closeHandler}
            open={isTopLayer}
        >
            <DialogTitle
                sx={{
                    alignItems: "flex-start",
                    display: "flex",
                    gap: 1,
                    justifyContent: "space-between",
                    pb: 1,
                }}
            >
                <Stack spacing={0.5}>
                    <Typography
                        component="span"
                        sx={{ fontWeight: "bold" }}
                        variant="h5"
                    >
                        {isDraft ? DRAFT_TITLE : `עריכת סילבוס: ${syllabus?.title ?? ""}`}
                    </Typography>
                    <SaveStatusIndicator status={saveStatus} />
                    {isDraft ? null : (
                        <Typography
                            component="span"
                            sx={{ color: "text.secondary" }}
                            variant="caption"
                        >
                            {`${syllabus?.modules?.length ?? 0} מערכים · ${
                                syllabus?.shuffles?.length ?? 0
                            } שאפלים`}
                        </Typography>
                    )}
                </Stack>
                {syllabusId ? (
                    <SyllabusImportExportButton
                        curriculumId={curriculumId}
                        syllabusId={syllabusId}
                        title={syllabus?.title}
                    />
                ) : null}
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
                        <Stack alignItems="stretch" direction="row" gap={1}>
                            <TextField
                                autoFocus={isDraft}
                                error={showTitleError}
                                fullWidth
                                helperText={
                                    isDraft
                                        ? DRAFT_NAME_HINT
                                        : titleMissing
                                            ? "לסילבוס חייב להיות שם. השם הקודם יישמר."
                                            : undefined
                                }
                                label="שם הסילבוס"
                                onBlur={(e) => {
                                    if (isDraft) {
                                        // Moving on to another field commits the
                                        // name; cancelling, clicking the backdrop
                                        // or leaving the window must not.
                                        const next = e.relatedTarget as HTMLElement | null;
                                        const dialog = e.currentTarget.closest("[role='dialog']");
                                        if (next && dialog?.contains(next) && !next.dataset.draftCancel) {
                                            createFromDraft();
                                        }
                                        return;
                                    }
                                    // An empty title leaves the card nameless, so
                                    // the field falls back to the saved one.
                                    if (titleMissing) {
                                        setLocalTitle(syllabus?.title ?? "");
                                        return;
                                    }
                                    commit({ title: localTitle.trim() });
                                }}
                                onChange={(e) => setLocalTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (isDraft && e.key === "Enter") {
                                        e.preventDefault();
                                        createFromDraft();
                                    }
                                }}
                                required
                                size="small"
                                value={localTitle}
                            />
                            {isDraft ? null : (
                                <ColorPickerField
                                    event={{ color: syllabus?.color ?? undefined }}
                                    onUpdate={({ color }) =>
                                        commit({ color: color ?? null })
                                    }
                                    size="small"
                                />
                            )}
                        </Stack>

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

                        {syllabusId ? (
                            <>
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
                            </>
                        ) : draftHint}
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
                        {syllabusId ? (
                            <ModulesTable
                                curriculumId={curriculumId}
                                maxHeight="60vh"
                                syllabusId={syllabusId}
                                syllabusModules={syllabus?.modules ?? []}
                            />
                        ) : draftHint}
                    </Stack>
                </Box>
            </DialogContent>

            <DialogActions>
                {covered || isDraft ? null : (
                    // describeChild: the visible text stays the name; the hint
                    // becomes the description (#837, WCAG 2.5.3).
                    <Tooltip describeChild title={UNLINK_HINT}>
                        <Button
                            color="warning"
                            onClick={() => void unlinkHandler()}
                            startIcon={<LinkOffIcon fontSize="small" />}
                        >
                            הסרה מהגאנט
                        </Button>
                    </Tooltip>
                )}
                <Button
                    color="primary"
                    data-draft-cancel={isDraft ? "true" : undefined}
                    disabled={creatingDraft}
                    onClick={closeHandler}
                    variant="contained"
                >
                    {isDraft ? "ביטול" : "סגירה"}
                </Button>
            </DialogActions>
            {confirmDialog}
        </Dialog>
    );
}
