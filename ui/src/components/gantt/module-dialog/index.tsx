import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog, { DialogProps } from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useState,
    useTransition,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    GanttCurriculumId,
    GanttEventId,
    GanttModule,
    GanttModuleId,
    GanttSyllabusId,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { ModuleConstraintsView } from "@/components/gantt/module-dialog/constraints/ModuleConstraintsView";
import { ModuleEventsView } from "@/components/gantt/module-dialog/ModuleEventsView";
import { HiveLessonsView, HiveModulesView } from "@/components/gantt/module-dialog/utils";
import { GanttConstraintProvider } from "@/components/gantt/state/constraints/Provider";
import { useModuleActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleActions";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useModule } from "@/components/gantt/state/hooks/UseModule";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";

export type ModuleDialogProps = {
    setOpen: Dispatch<SetStateAction<boolean>>;
    moduleId: GanttModuleId | null;
    syllabusId: GanttSyllabusId | null;
    curriculumId: GanttCurriculumId | null;
    /** When set, the matching event row is scrolled into view and highlighted. */
    focusEventId?: GanttEventId | null;
} & DialogProps;

type ModuleDialogHeaderProps = {
    moduleTitle?: string;
    syllabusTitle?: string;
}

function ModuleDialogHeader({ moduleTitle, syllabusTitle }: ModuleDialogHeaderProps) {
    return (
        <DialogTitle sx={{ pb: 1 }}>
            <Stack spacing={0.5}>
                <Typography component="span" sx={{ fontWeight: "bold" }} variant="h5">
                    עריכת מערך: {moduleTitle}
                </Typography>
                {!!syllabusTitle && (
                    <Typography
                        component="span"
                        sx={{ color: "text.secondary" }}
                        variant="caption"
                    >
                        סילבוס: {syllabusTitle}
                    </Typography>
                )}
            </Stack>
        </DialogTitle>
    );
}

type SiblingModuleNavProps = {
    modules: Array<GanttModule>;
    currentModuleId: string;
    isCreatingNew: boolean;
    onNavigate: (moduleId: string) => void;
    onCreateNew: () => void;
}

function SiblingModuleNav({
    modules,
    currentModuleId,
    isCreatingNew,
    onNavigate,
    onCreateNew,
}: SiblingModuleNavProps) {
    if (modules.length === 0) return null;

    return (
        <Box
            sx={{
                alignItems: "center",
                borderBottom: 1,
                borderColor: "divider",
                display: "flex",
                gap: 2,
                mb: 2,
                pb: 2,
            }}
        >
            <Typography
                sx={{
                    color: "text.secondary",
                    fontWeight: "bold",
                    whiteSpace: "nowrap",
                }}
                variant="body2"
            >
                מערכים בסילבוס זה:
            </Typography>
            <Stack
                direction="row"
                spacing={1}
                sx={{
                    flexGrow: 1,
                    overflowX: "auto",
                    pb: 1,
                    pt: 1,
                    px: 0.5,
                    "&::-webkit-scrollbar": { height: 4 },
                    "&::-webkit-scrollbar-thumb": {
                        bgcolor: "action.selected",
                        borderRadius: 2,
                    },
                }}
            >
                {modules.map((m) => {
                    const isActive = m.id === currentModuleId;
                    return (
                        <Button
                            key={m.id}
                            onClick={() => onNavigate(m.id)}
                            size="small"
                            sx={{
                                borderRadius: 2,
                                fontWeight: isActive ? "bold" : "normal",
                                minWidth: "auto",
                                px: 2,
                                py: 0.5,
                                textTransform: "none",
                                transition: "all 0.2s ease-in-out",
                                whiteSpace: "nowrap",
                                "&:hover": {
                                    boxShadow: isActive ? 2 : 1,
                                    transform: "translateY(-1px)",
                                },
                            }}
                            variant={isActive ? "contained" : "outlined"}
                        >
                            {m.title}
                        </Button>
                    );
                })}
                <Button
                    color="secondary"
                    disabled={isCreatingNew}
                    onClick={onCreateNew}
                    size="small"
                    sx={{
                        borderRadius: 2,
                        minWidth: "auto",
                        px: 2,
                        py: 0.5,
                        transition: "all 0.2s ease-in-out",
                        whiteSpace: "nowrap",
                        "&:hover": {
                            boxShadow: 1,
                            transform: "translateY(-1px)",
                        },
                    }}
                    variant="outlined"
                >
                    {isCreatingNew ? "מייצר..." : "+ חדש"}
                </Button>
            </Stack>
        </Box>
    );
}

type ModuleDetailsFormProps = {
    localTitle: string;
    localDescription: string;
    hiveModules: Array<number>;
    setLocalTitle: (val: string) => void;
    setLocalDescription: (val: string) => void;
    onCommitTitle: () => void;
    onCommitDescription: () => void;
}

function ModuleDetailsForm({
    localTitle,
    localDescription,
    hiveModules,
    setLocalTitle,
    setLocalDescription,
    onCommitTitle,
    onCommitDescription,
}: ModuleDetailsFormProps) {
    return (
        <Stack spacing={2} width="30%">
            <TextField
                fullWidth
                label="כותרת"
                onBlur={onCommitTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                value={localTitle}
            />

            <TextField
                fullWidth
                label="תיאור"
                minRows={10}
                multiline
                onBlur={onCommitDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                sx={{
                    flex: 1,
                    "& .MuiInputBase-root": {
                        height: "100%",
                        alignItems: "stretch",
                    },
                    "& textarea": { height: "100% !important" },
                }}
                value={localDescription}
            />

            <HiveModulesView hiveModules={hiveModules} />
            <HiveLessonsView hiveModules={hiveModules} />
        </Stack>
    );
}

function ModuleDialogInner({
    open,
    setOpen,
    syllabusId,
    moduleId,
    focusEventId,
    ...props
}: Omit<ModuleDialogProps, "curriculumId">) {
    const { enqueueSnackbar } = useSnackbar();
    const { closeModuleDialog, openModuleDialog } = useCurriculumProviderActions();
    const { createModule, deleteModule, updateModule } = useModuleActions();
    const { createEvent } = useModuleEventActions();

    const moduleDoc = useModule(moduleId ?? "");
    const state = useCurriculumState();
    const syllabus = syllabusId ? state.syllabuses[syllabusId] : null;
    const siblingModules = useMemo(() => syllabus ? syllabus.modules.map((mId) => state.modules[mId]) : [], [syllabus, state.modules]);
    const handleNavigate = useCallback((mId: string) => {
        if (!syllabusId) return;
        openModuleDialog(syllabusId, mId);
    }, [syllabusId, openModuleDialog]);

    const [isContentReady, setIsContentReady] = useState(false);
    const [, startTransition] = useTransition();

    useEffect(() => {
        if (!open) setIsContentReady(false);
    }, [open]);

    const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
    const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

    const handleCreateNew = useCallback(async () => {
        if (!syllabusId) return;
        setIsCreatingNew(true);
        try {
            const newModule = await createModule(
                "מערך חדש",
                syllabusId,
                "המערך החדש שלי",
            );
            handleNavigate(newModule.id);
            try {
                await createEvent("הרצאת מבוא", newModule.id, ModuleEventType.Lecture, 60);
                await createEvent('ע"ע', newModule.id, ModuleEventType.Exercise, 45);
            } catch (error) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "יצירת מופעי ברירת מחדל במערך נכשלה!",
                    error,
                );
            }
        } catch (error) {
            enqueueApiErrorSnackbar(enqueueSnackbar, "יצירת המערך נכשלה!", error);
        } finally {
            setIsCreatingNew(false);
        }
    }, [syllabusId, createModule, createEvent, handleNavigate, enqueueSnackbar]);

    const [localTitle, setLocalTitle] = useState(moduleDoc?.title ?? "");
    const [localDescription, setLocalDescription] = useState(moduleDoc?.description ?? "");

    // The dialog is no longer remounted per-module (to avoid a close→reopen
    // flicker when navigating siblings), so reset the local form fields from
    // the newly selected module whenever the active module changes.
    useEffect(() => {
        setLocalTitle(moduleDoc?.title ?? "");
        setLocalDescription(moduleDoc?.description ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when the selected module changes, not on every keystroke
    }, [moduleId]);

    const handleClose = useCallback(() => {
        setOpen(false);
    }, [setOpen]);

    const handleCommit = useCallback(
        (updates: Partial<GanttModule>) => {
            if (!syllabusId || !moduleId || !moduleDoc) return;

            const changedUpdates: Partial<GanttModule> = {};
            let hasChanges = false;

            for (const [key, value] of Object.entries(updates)) {
                if (moduleDoc[key as keyof GanttModule] !== value) {
                    (changedUpdates as any)[key] = value;
                    hasChanges = true;
                }
            }

            if (!hasChanges) return;

            updateModule(moduleId, changedUpdates).catch((error) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "שמירת המערך נכשלה!", error),
            );
        },
        [moduleId, syllabusId, moduleDoc, updateModule, enqueueSnackbar],
    );

    const handleDelete = useCallback(() => {
        if (!syllabusId || !moduleId) return;

        setIsActionLoading(true);
        deleteModule(syllabusId, moduleId)
            .then(() => {
                closeModuleDialog();
                setIsActionLoading(false);
                setOpen(false);
            })
            .catch(() => setIsActionLoading(false));
    }, [syllabusId, moduleId, deleteModule, closeModuleDialog, setOpen]);

    if (syllabusId === null || moduleId === null) return null;

    return (
        <Dialog
            fullWidth
            maxWidth="xl"
            onClose={handleClose}
            open={open}
            {...props}
            transitionDuration={{ enter: 200, exit: 100 }}
            TransitionProps={{ onEnter: () => startTransition(() => setIsContentReady(true)) }}
        >
            <ModuleDialogHeader
                moduleTitle={moduleDoc?.title}
                syllabusTitle={syllabus?.title}
            />

            <DialogContent sx={{ pt: 1, mt: -1 }}>
                {!!syllabus && (
                    <SiblingModuleNav
                        currentModuleId={moduleId}
                        isCreatingNew={isCreatingNew}
                        modules={siblingModules}
                        onCreateNew={handleCreateNew}
                        onNavigate={handleNavigate}
                    />
                )}

                <Box alignItems="flex-start" display="flex" flexDirection="row" gap={2} mt={1}>
                    {isContentReady ? (
                        <>
                            <ModuleDetailsForm
                                hiveModules={moduleDoc?.hiveIds ?? []}
                                localDescription={localDescription}
                                localTitle={localTitle}
                                onCommitDescription={() => handleCommit({ description: localDescription })}
                                onCommitTitle={() => handleCommit({ title: localTitle })}
                                setLocalDescription={setLocalDescription}
                                setLocalTitle={setLocalTitle}
                            />

                            <Divider flexItem orientation="vertical" />

                            <Stack flexGrow={1} mt={1} spacing={2}>
                                <ModuleEventsView
                                    eventIds={moduleDoc?.events ?? []}
                                    focusEventId={focusEventId}
                                    moduleId={moduleId}
                                />
                            </Stack>
                        </>
                    ) : (
                        <>
                            <Stack spacing={2} width="30%">
                                <Skeleton height={56} variant="rounded" />
                                <Skeleton height={240} variant="rounded" />
                                <Skeleton height={40} variant="rounded" />
                                <Skeleton height={40} variant="rounded" />
                            </Stack>
                            <Divider flexItem orientation="vertical" />
                            <Stack flexGrow={1} mt={1} spacing={1}>
                                <Skeleton height={42} variant="rounded" />
                                <Skeleton height={52} variant="rounded" />
                                <Skeleton height={52} variant="rounded" />
                                <Skeleton height={52} variant="rounded" />
                            </Stack>
                        </>
                    )}
                </Box>

                <Box height="1rem" />
                <ModuleConstraintsView moduleId={moduleId} />
            </DialogContent>

            <DialogActions>
                <Button color="error" disabled={isActionLoading} onClick={handleDelete}>
                    מחיקה
                </Button>
                <Button color="primary" disabled={isActionLoading} onClick={handleClose} variant="contained">
                    סגירה
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export function ModuleDialog({
    curriculumId,
    syllabusId,
    moduleId,
    focusEventId,
    ...props
}: ModuleDialogProps) {
    // Stable identity: GanttConstraintProvider refetches whenever this
    // object's reference changes, so it must not be recreated on every
    // render (e.g. while typing in unrelated fields).
    const constraintContext = useMemo(
        () =>
            syllabusId && moduleId && curriculumId
                ? ({
                    type: "module" as const,
                    curriculumId,
                    syllabusId,
                    moduleId,
                })
                : null,
        [curriculumId, syllabusId, moduleId],
    );

    if (!constraintContext) {
        return (
            <ModuleDialogInner
                focusEventId={focusEventId}
                moduleId={moduleId}
                syllabusId={syllabusId}
                {...props}
            />
        );
    }

    return (
        <GanttConstraintProvider context={constraintContext}>
            <ModuleDialogInner
                focusEventId={focusEventId}
                moduleId={moduleId}
                syllabusId={syllabusId}
                {...props}
            />
        </GanttConstraintProvider>
    );
}
