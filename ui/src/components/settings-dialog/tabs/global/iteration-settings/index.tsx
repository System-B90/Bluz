import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    apiListIterations,
    apiPatchIteration,
    apiRegisterIteration,
} from "@/api-client/iterations";
import { Iteration } from "@/api-shared/types/iteration";
import { SettingsTab } from "@/components/settings-dialog/tabs/global/common";
import { useEntityForm } from "@/components/settings-dialog/tabs/global/common/UseEntityForm";
import { IterationFormCard, IterationFormCardProps } from "@/components/settings-dialog/tabs/global/iteration-settings/IterationFormCard";
import { IterationListCard, IterationListCardProps } from "@/components/settings-dialog/tabs/global/iteration-settings/IterationListCard";
import {
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
                startDate: values.startDate
                    ? new Date(values.startDate)
                    : undefined,
                endDate: values.endDate ? new Date(values.endDate) : null,
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
                endDate: values.endDate ? new Date(values.endDate) : null,
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

    const handleMakeCurrent = useCallback(
        (iteration: Iteration) =>
        {
            setBusyId(iteration.id);
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
            <Alert severity="info">
                כל מחזור מנוהל במסד נתונים נפרד. רק המחזור הפעיל ניתן לעריכה
                בלוח השנה; מחזורים קודמים הם לקריאה בלבד.
            </Alert>
            <SettingsTab<Iteration, IterationFormCardProps, IterationListCardProps>
                FormCard={ IterationFormCard }
                formCardProps={ {
                    handleCancelEdit: form.handleCancelEdit,
                    handleSave: form.handleSave,
                    handleStartCreate: form.handleStartCreate,
                    isCreating: form.isCreating,
                    isSubmitting: form.isSubmitting,
                    setValue: form.setValue,
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
        </Box>
    );
}
