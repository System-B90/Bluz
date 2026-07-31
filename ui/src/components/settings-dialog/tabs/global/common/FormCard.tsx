import Box from "@mui/material/Box";
import { ReactNode } from "react";

import { SettingsFormActions } from "@/components/settings-dialog/tabs/global/common/FormActions";
import { SettingsFormHeader, SettingsFormHeaderProps } from "@/components/settings-dialog/tabs/global/common/FormHeader";
import { SettingsFormPlaceholder } from "@/components/settings-dialog/tabs/global/common/FormPlaceholder";
// From the leaf module, not the barrel: the barrel re-exports this card, so
// going through it would make the pair a dependency cycle.
import { settingsCardSx } from "@/components/settings-dialog/tabs/global/common/styles";

export type FormCardBaseProps<TEntity> = {
    selectedEntity: null | TEntity;
    isCreating: boolean;
    handleSave: (e: React.FormEvent) => Promise<void>;
    handleCancelEdit: () => void;
};

/**
 * What a tab may vary about its action row: the submit wording, a pending
 * flag, and extra buttons. The layout itself is not negotiable — that is the
 * point of the shared panel. Tabs used to hand-roll their own rows and ended
 * up with different button order, colours and cancel wording.
 */
export type FormActions = {
    label: { creating: string; editing: string; };
    isSubmitting?: boolean;
    extraActions?: ReactNode;
};

/** Header text, minus the two flags the panel already knows. */
export type FormHeader = Omit<SettingsFormHeaderProps, "isCreating" | "isEditing">;

export type BaseFormCardProps<TEntity> = {
    formActions: FormActions;
    formHeader: FormHeader;
    placeholderMessage: string;
    formFields: ReactNode;
} & FormCardBaseProps<TEntity>;

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
    const isEditing = selectedEntity !== null;
    const showForm = isCreating || isEditing;

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
            <SettingsFormHeader
                { ...formHeader }
                isCreating={ isCreating }
                isEditing={ isEditing }
            />

            { !showForm ? (
                <SettingsFormPlaceholder message={ placeholderMessage } />
            ) : (
                <>
                    { formFields }

                    <SettingsFormActions
                        extraActions={ formActions.extraActions }
                        isSubmitting={ formActions.isSubmitting }
                        onCancel={ handleCancelEdit }
                        submitColor={ isCreating ? "secondary" : "primary" }
                        submitLabel={ isCreating
                            ? formActions.label.creating
                            : formActions.label.editing }
                    />
                </>
            ) }
        </Box>
    );
};
