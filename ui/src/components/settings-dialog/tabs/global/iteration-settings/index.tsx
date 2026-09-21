import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
    apiDeleteIteration,
    apiGetIterationUsage,
    apiListIterations,
    apiPatchIteration,
    apiRegisterIteration,
    apiSyncIterationHive,
} from "@/api-client/iterations";
import { Iteration, IterationUsage } from "@/api-shared/types/iteration";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { noteLocalIterationSwitch } from "@/components/base/IterationProvider";
import { useConfirmDialog } from "@/components/base/UseConfirmDialog";
import { SettingsTab } from "@/components/settings-dialog/tabs/global/common";
import { useEntityForm } from "@/components/settings-dialog/tabs/global/common/UseEntityForm";
import { IterationFormCard, IterationFormCardProps } from "@/components/settings-dialog/tabs/global/iteration-settings/IterationFormCard";
import { IterationListCard, IterationListCardProps } from "@/components/settings-dialog/tabs/global/iteration-settings/IterationListCard";
import {
    describeHiveSyncChanges,
    EMPTY_ITERATION_VALUES,
    iterationToValues,
    IterationValues,
    validateIteration,
} from "@/components/settings-dialog/tabs/global/iteration-settings/values";

export function IterationSettings()
{
    const { enqueueSnackbar } = useSnackbar();
    const [ iterations, setIterations ] = useState<Array<Iteration> | null>(null);
    const [ searchQuery, setSearchQuery ] = useState("");
    const [ busyId, setBusyId ] = useState<null | string>(null);
    // Tracked apart from `busyId` so "make current" on the selected iteration
    // does not spin the sync button too.
    const [ syncingId, setSyncingId ] = useState<null | string>(null);
    const [ deletingId, setDeletingId ] = useState<null | string>(null);
    // What the selected iteration still owns, tagged with the id it was probed
    // for so a stale result can never license a delete on another iteration.
    const [ usageResult, setUsageResult ] = useState<
        { id: string; usage: IterationUsage } | null
    >(null);
    const { confirm, confirmDialog } = useConfirmDialog();

    const load = useCallback(() =>
    {
        apiListIterations()
            .then(setIterations)
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת המחזורים נכשלה.",
                    error,
                ),
            );
    }, [ enqueueSnackbar ]);

    useEffect(() =>
    {
        load();
    }, [ load ]);

    const onCreate = useCallback(
        async (values: IterationValues) =>
        {
            const saved = await apiRegisterIteration({
                id: values.id.trim(),
                label: values.label.trim(),
                hiveUrl: values.hiveUrl.trim() || undefined,
                startDate: values.startDate && values.startDate.isValid()
                    ? values.startDate.toDate()
                    : undefined,
                endDate: values.endDate && values.endDate.isValid()
                    ? values.endDate.toDate()
                    : null,
            });
            enqueueSnackbar("המחזור נוצר בהצלחה", { variant: "success" });
            load();
            return saved;
        },
        [ enqueueSnackbar, load ],
    );

    const onUpdate = useCallback(
        async (iteration: Iteration, values: IterationValues) =>
        {
            const saved = await apiPatchIteration(iteration.id, {
                label: values.label.trim(),
                hiveUrl: values.hiveUrl.trim() || undefined,
                startDate: values.startDate && values.startDate.isValid()
                    ? values.startDate.toDate()
                    : undefined,
                endDate: values.endDate && values.endDate.isValid()
                    ? values.endDate.toDate()
                    : null,
            });
            enqueueSnackbar("המחזור עודכן", { variant: "success" });
            load();
            return saved;
        },
        [ enqueueSnackbar, load ],
    );

    const form = useEntityForm<Iteration, IterationValues>({
        emptyValues: EMPTY_ITERATION_VALUES,
        errorMessages: {
            create: "יצירת המחזור נכשלה.",
            update: "עדכון המחזור נכשל.",
        },
        // Saving here means "apply my edits", so the iteration stays selected
        // and the form is refreshed from the server's copy.
        keepSelectionAfterSave: true,
        onCreate,
        onUpdate,
        toValues: iterationToValues,
        validate: validateIteration,
    });

    // Re-probed on every selection change and after a promote/edit, since both
    // can flip whether the iteration is deletable.
    const selectedId = form.selectedEntity?.id;
    useEffect(() =>
    {
        if (!selectedId) return;
        let mounted = true;
        apiGetIterationUsage(selectedId)
            .then((result) =>
            {
                if (mounted) setUsageResult({ id: selectedId, usage: result });
            })
            .catch(() =>
            {
                // A failed probe must not offer a delete it cannot justify.
                if (mounted) setUsageResult(null);
            });
        return () =>
        {
            mounted = false;
        };
    }, [ iterations, selectedId ]);

    const usage = usageResult && usageResult.id === selectedId
        ? usageResult.usage
        : null;

    const handleDelete = useCallback(
        async (iteration: Iteration) =>
        {
            const approved = await confirm(
                `למחוק את המחזור "${iteration.label}"? מסד הנתונים עצמו יישמר.`,
                { title: "מחיקת מחזור" },
            );
            if (!approved) return;

            setDeletingId(iteration.id);
            try
            {
                await apiDeleteIteration(iteration.id);
                enqueueSnackbar("המחזור נמחק", { variant: "success" });
                form.handleCancelEdit();
                load();
            }
            catch (error)
            {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "מחיקת המחזור נכשלה.",
                    error,
                );
            }
            finally
            {
                setDeletingId(null);
            }
        },
        [ confirm, enqueueSnackbar, form, load ],
    );

    const handleMakeCurrent = useCallback(
        (iteration: Iteration) =>
        {
            setBusyId(iteration.id);
            noteLocalIterationSwitch(iteration.id);
            apiPatchIteration(iteration.id, { isCurrent: true })
                .then(() =>
                {
                    enqueueSnackbar(`"${iteration.label}" הוגדר כמחזור הפעיל`, {
                        variant: "success",
                    });
                    load();
                })
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "קביעת המחזור הפעיל נכשלה.",
                        error,
                    ),
                )
                .finally(() => setBusyId(null));
        },
        [ enqueueSnackbar, load ],
    );

    const handleSyncHive = useCallback(
        (iteration: Iteration) =>
        {
            setSyncingId(iteration.id);
            apiSyncIterationHive(iteration.id)
                .then(({ changes }) =>
                {
                    enqueueSnackbar(describeHiveSyncChanges(changes), {
                        variant: "success",
                    });
                    load();
                })
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "סנכרון פרטי ההייב נכשל.",
                        error,
                    ),
                )
                .finally(() => setSyncingId(null));
        },
        [ enqueueSnackbar, load ],
    );

    const filteredIterations = useMemo(() =>
    {
        const all = iterations ?? [];
        const query = searchQuery.trim().toLowerCase();
        if (!query) return all;
        return all.filter(
            (iteration) =>
                iteration.label.toLowerCase().includes(query) ||
                iteration.id.toLowerCase().includes(query),
        );
    }, [ iterations, searchQuery ]);

    if (iterations === null)
    {
        return (
            <Box display="flex" justifyContent="center" sx={ { py: 6 } }>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box display="flex" flexDirection="column" gap={ 2 } width="100%">
            <SettingsTab<Iteration, IterationFormCardProps, IterationListCardProps>
                FormCard={ IterationFormCard }
                formCardProps={ {
                    handleCancelEdit: form.handleCancelEdit,
                    handleDelete,
                    handleSave: form.handleSave,
                    handleSyncHive,
                    isCreating: form.isCreating,
                    isDeleting: deletingId === form.selectedEntity?.id,
                    isSubmitting: form.isSubmitting,
                    isSyncingHive: syncingId === form.selectedEntity?.id,
                    setValue: form.setValue,
                    usage,
                    values: form.values,
                } }
                ListCard={ IterationListCard }
                listCardProps={ {
                    busyId,
                    filteredEntities: filteredIterations,
                    handleStartCreate: form.handleStartCreate,
                    onMakeCurrent: handleMakeCurrent,
                    populateFormFrom: form.populateFormFrom,
                    searchQuery,
                    setSearchQuery,
                } }
                selectedEntity={ form.selectedEntity }
            />
            { confirmDialog }
        </Box>
    );
}
