import Box from "@mui/material/Box";
import { isValidElement, ReactNode } from "react";

import { settingsCardSx } from "@/components/settings-dialog/tabs/global/common";
import { SettingsFormActions } from "@/components/settings-dialog/tabs/global/common/FormActions";
import { SettingsFormPlaceholder } from "@/components/settings-dialog/tabs/global/common/FormPlaceholder";

export type FormCardBaseProps<TEntity> = {
    selectedEntity: null | TEntity;
    isCreating: boolean;
    handleSave: (e: React.FormEvent) => Promise<void>;
    handleCancelEdit: () => void;
};

export type FormActions = {
    label: { creating: string; editing: string; };
} | ReactNode;

export type BaseFormCardProps<TEntity> = {
    formActions: FormActions;
    formHeader: ReactNode;
    placeholderMessage: string;
    formFields: ReactNode;
} & FormCardBaseProps<TEntity>;

function FormActionsWrapper<TEntity>({
    isCreating,
    handleCancelEdit,
    formActions
}: Pick<BaseFormCardProps<TEntity>, 'formActions' | 'handleCancelEdit' | 'isCreating'>)
{
    const isLabels = !isValidElement(formActions) && typeof formActions === "object" && formActions !== null && "label" in formActions;

    return (
        isLabels ? (<SettingsFormActions
            onCancel={ handleCancelEdit }
            submitColor={ isCreating ? "secondary" : "primary" }
            submitLabel={ isCreating ? formActions.label.creating : formActions.label.editing }
        />) : formActions
    );
}

export function BaseFormCard<TEntity>({
    selectedEntity,
    isCreating,
    formHeader,
    placeholderMessage,
    formFields,
    formActions,
    handleSave,
    handleCancelEdit,
}: BaseFormCardProps<TEntity>)
{
    const showForm = isCreating || selectedEntity !== null;

    return (
        <Box
            component="form"
            onSubmit={ handleSave }
            sx={ {
                ...settingsCardSx,
                flex: 1,
                gap: 3,
                opacity: showForm ? 1 : 0.5,
                transition: "opacity 0.3s ease",
            } }
        >
            { formHeader }

            { !showForm ? (
                <SettingsFormPlaceholder message={ placeholderMessage } />
            ) : (
                <>
                    { formFields }

                    <FormActionsWrapper formActions={ formActions } handleCancelEdit={ handleCancelEdit } isCreating={ isCreating } />
                </>
            ) }
        </Box>
    );
};
