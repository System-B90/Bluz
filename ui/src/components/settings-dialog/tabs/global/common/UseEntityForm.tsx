"use client";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useConfirmDialog } from "@/components/settings-dialog/tabs/global/common/UseConfirmDialog";

/**
 * A validation failure: the message shown to the user as a warning snackbar.
 * Returning `null` means the values are valid.
 */
export type ValidationResult = null | string;

export type UseEntityFormProps<TEntity, TValues> = {
    /** Blank form — used for "create new" and for clearing after save/cancel. */
    emptyValues: TValues;
    /** Fills the form when an existing entity is selected for editing. */
    toValues: (entity: TEntity) => TValues;
    /**
     * Checked before any request. Return the warning to show, or `null` to
     * proceed. Trimming belongs here or in `onCreate`/`onUpdate` — the hook
     * deliberately does not trim, since which fields are strings is the
     * caller's business.
     */
    validate: (values: TValues) => ValidationResult;
    /**
     * Returning the saved entity lets `keepSelectionAfterSave` re-populate the
     * form from the server's version. Returning nothing is fine otherwise.
     */
    onCreate: (values: TValues) => Promise<TEntity | unknown>;
    onUpdate: (entity: TEntity, values: TValues) => Promise<TEntity | unknown>;
    onDelete?: (id: string) => Promise<unknown>;
    /**
     * By default a successful save clears the form, which is what a
     * list-and-add tab wants. Set this to keep the saved entity selected and
     * the form populated from whatever `onCreate`/`onUpdate` returned — for
     * tabs where saving is "apply my edits", not "add another".
     */
    keepSelectionAfterSave?: boolean;
    /** Error snackbar titles, e.g. `{ create: "שגיאה ביצירת איש חוץ" }`. */
    errorMessages: {
        create: string;
        update: string;
        delete?: string;
    };
    /** Builds the delete confirmation prompt for a given id. */
    confirmDeleteMessage?: (id: string) => string;
    /** Runs after the selection changes, e.g. to sync a URL query param. */
    onSelectionChange?: (entityId: null | string) => void;
};

/**
 * The "list + form" state every settings tab was re-implementing: which entity
 * is selected, whether we are creating, one value bag, and the
 * populate / start-create / cancel / save / delete handlers around it —
 * including the validate-then-snackbar and the error snackbar on failure.
 *
 * Extracted from the outsider and room tabs, which had this same shape spelled
 * out field by field (see #191). Keeping it in one place also means the tabs
 * pass a single `form` object to their FormCard instead of drilling every
 * value and setter as its own prop.
 */
export function useEntityForm<
    // Hive-sourced rooms carry a numeric id, so this cannot be narrowed to
    // `string` — `onSelectionChange` receives the stringified form.
    TEntity extends { id?: number | string },
    TValues,
>({
    emptyValues,
    toValues,
    validate,
    onCreate,
    onUpdate,
    onDelete,
    errorMessages,
    confirmDeleteMessage,
    onSelectionChange,
    keepSelectionAfterSave = false,
}: UseEntityFormProps<TEntity, TValues>) {
    const { enqueueSnackbar } = useSnackbar();
    const { confirm, confirmDialog } = useConfirmDialog();

    const [values, setValues] = useState<TValues>(emptyValues);
    const [selectedEntity, setSelectedEntity] = useState<null | TEntity>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    /** Updates one field, leaving the rest untouched. */
    const setValue = useCallback(
        <TKey extends keyof TValues>(key: TKey, value: TValues[TKey]) => {
            setValues((previous) => ({ ...previous, [key]: value }));
        },
        [],
    );

    /**
     * Loads an entity into the form. Does not notify `onSelectionChange` —
     * callers that sync a URL param drive that themselves, so restoring a
     * selection *from* the URL doesn't write it straight back.
     */
    const populateFormState = useCallback(
        (entity: TEntity) => {
            setSelectedEntity(entity);
            setIsCreating(false);
            setValues(toValues(entity));
        },
        [toValues],
    );

    const populateFormFrom = useCallback(
        (entity: TEntity) => {
            populateFormState(entity);
            onSelectionChange?.(
                entity.id === undefined ? null : String(entity.id),
            );
        },
        [populateFormState, onSelectionChange],
    );

    const resetForm = useCallback(() => {
        setSelectedEntity(null);
        setValues(emptyValues);
        onSelectionChange?.(null);
    }, [emptyValues, onSelectionChange]);

    const handleStartCreate = useCallback(() => {
        setIsCreating(true);
        resetForm();
    }, [resetForm]);

    const handleCancelEdit = useCallback(() => {
        setIsCreating(false);
        resetForm();
    }, [resetForm]);

    const handleSave = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();

            const validationError = validate(values);
            if (validationError) {
                enqueueSnackbar(validationError, { variant: "warning" });
                return;
            }

            // Nothing selected and not creating: the form is a placeholder.
            if (!isCreating && !selectedEntity) return;

            setIsSubmitting(true);
            try {
                const saved = isCreating
                    ? await onCreate(values)
                    : await onUpdate(selectedEntity as TEntity, values);

                if (!keepSelectionAfterSave) {
                    handleCancelEdit();
                } else if (saved) {
                    // Re-read from the server's copy so any field it
                    // normalised (ids, dates) is reflected in the form.
                    populateFormState(saved as TEntity);
                }
            } catch (error) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    isCreating ? errorMessages.create : errorMessages.update,
                    error,
                );
            } finally {
                setIsSubmitting(false);
            }
        },
        [
            values,
            validate,
            isCreating,
            selectedEntity,
            onCreate,
            onUpdate,
            handleCancelEdit,
            keepSelectionAfterSave,
            populateFormState,
            enqueueSnackbar,
            errorMessages,
        ],
    );

    const handleDelete = useCallback(
        async (id: string) => {
            if (!onDelete) return;

            if (confirmDeleteMessage) {
                const confirmed = await confirm(confirmDeleteMessage(id));
                if (!confirmed) return;
            }

            try {
                // Clear the form first: deleting the entity being edited would
                // otherwise leave the fields populated from a row that no
                // longer exists.
                if (selectedEntity?.id === id) handleCancelEdit();
                await onDelete(id);
            } catch (error) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    errorMessages.delete ?? errorMessages.update,
                    error,
                );
            }
        },
        [
            onDelete,
            confirmDeleteMessage,
            confirm,
            selectedEntity,
            handleCancelEdit,
            enqueueSnackbar,
            errorMessages,
        ],
    );

    return useMemo(
        () => ({
            values,
            setValue,
            setValues,
            selectedEntity,
            isCreating,
            isSubmitting,
            populateFormState,
            populateFormFrom,
            handleStartCreate,
            handleCancelEdit,
            handleSave,
            handleDelete,
            confirmDialog,
        }),
        [
            values,
            setValue,
            selectedEntity,
            isCreating,
            isSubmitting,
            populateFormState,
            populateFormFrom,
            handleStartCreate,
            handleCancelEdit,
            handleSave,
            handleDelete,
            confirmDialog,
        ],
    );
}
