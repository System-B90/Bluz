import Box from "@mui/material/Box";

import { FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";

export { iconBadgeSx, settingsCardSx } from "@/components/settings-dialog/tabs/global/common/styles";

export type ListCardBaseProps<TEntity> = {
    filteredEntities: Array<TEntity>;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedEntity: null | TEntity;
    populateFormFrom: (entity: TEntity) => void;
    handleStartCreate: () => void;
    handleDelete: (id: string) => Promise<void>;
};

export type ListCard<TEntity> = React.ComponentType<ListCardBaseProps<TEntity>>;
export type FormCard<TEntity, FormCardProps extends Omit<FormCardBaseProps<TEntity>, "selectedEntity"> = Omit<FormCardBaseProps<TEntity>, "selectedEntity">> =
    React.ComponentType<FormCardProps & { selectedEntity: null | TEntity; }>;

export type SettingsTabProps<TEntity, FormCardProps extends Omit<FormCardBaseProps<TEntity>, "selectedEntity">> = {
    ListCard: ListCard<TEntity>;
    FormCard: FormCard<TEntity, FormCardProps>;
    selectedEntity: null | TEntity;
    listCardProps: Omit<ListCardBaseProps<TEntity>, "selectedEntity">;
    formCardProps: FormCardProps;
};

export function SettingsTab<TEntity, FormCardProps extends Omit<FormCardBaseProps<TEntity>, "selectedEntity"> = Omit<FormCardBaseProps<TEntity>, "selectedEntity">>(
    {
        ListCard, FormCard,
        selectedEntity, listCardProps, formCardProps,
    }: SettingsTabProps<TEntity, FormCardProps>
)
{
    return (
        <Box
            sx={ {
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                gap: 3,
                alignItems: "stretch",
                justifyContent: "center",
                width: "100%",
            } }
        >
            <ListCard selectedEntity={ selectedEntity } { ...listCardProps } />
            <FormCard selectedEntity={ selectedEntity } { ...formCardProps } />
        </Box>
    );
}

export * from "@/components/settings-dialog/tabs/global/common/BaseTimeSettingsCard";
