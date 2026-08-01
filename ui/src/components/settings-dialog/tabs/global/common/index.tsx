import Box from "@mui/material/Box";

import { FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";

export { iconBadgeSx, settingsCardSx } from "@/components/settings-dialog/tabs/global/common/styles";

export type ListCardBaseProps<TEntity> = {
    filteredEntities: Array<TEntity>;
    /** Renders skeleton rows instead of "no entries" while the fetch is in flight. */
    isLoading?: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedEntity: null | TEntity;
    populateFormFrom: (entity: TEntity) => void;
    handleStartCreate: () => void;
    handleDelete: (id: string) => Promise<void>;
};

/**
 * List-card props for a tab whose entities cannot be deleted — iterations own
 * a database each, so they are created and edited but never removed here.
 */
export type ReadOnlyListCardBaseProps<TEntity> = Omit<
    ListCardBaseProps<TEntity>,
    "handleDelete"
>;

export type ListCard<
    TEntity,
    ListCardProps extends Omit<ReadOnlyListCardBaseProps<TEntity>, "selectedEntity"> = Omit<ListCardBaseProps<TEntity>, "selectedEntity">,
> = React.ComponentType<ListCardProps & { selectedEntity: null | TEntity; }>;
export type FormCard<TEntity, FormCardProps extends Omit<FormCardBaseProps<TEntity>, "selectedEntity"> = Omit<FormCardBaseProps<TEntity>, "selectedEntity">> =
    React.ComponentType<FormCardProps & { selectedEntity: null | TEntity; }>;

export type SettingsTabProps<
    TEntity,
    FormCardProps extends Omit<FormCardBaseProps<TEntity>, "selectedEntity">,
    ListCardProps extends Omit<ReadOnlyListCardBaseProps<TEntity>, "selectedEntity"> = Omit<ListCardBaseProps<TEntity>, "selectedEntity">,
> = {
    ListCard: ListCard<TEntity, ListCardProps>;
    FormCard: FormCard<TEntity, FormCardProps>;
    selectedEntity: null | TEntity;
    listCardProps: ListCardProps;
    formCardProps: FormCardProps;
};

export function SettingsTab<
    TEntity,
    FormCardProps extends Omit<FormCardBaseProps<TEntity>, "selectedEntity"> = Omit<FormCardBaseProps<TEntity>, "selectedEntity">,
    ListCardProps extends Omit<ReadOnlyListCardBaseProps<TEntity>, "selectedEntity"> = Omit<ListCardBaseProps<TEntity>, "selectedEntity">,
>(
    {
        ListCard, FormCard,
        selectedEntity, listCardProps, formCardProps,
    }: SettingsTabProps<TEntity, FormCardProps, ListCardProps>
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
