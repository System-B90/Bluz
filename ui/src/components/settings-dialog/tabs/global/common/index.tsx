import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { FormCardBaseProps } from "@/components/settings-dialog/tabs/global/common/FormCard";

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

export const settingsCardSx: SxProps<Theme> = {
    minWidth: 0,
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "16px",
    p: 3,
    boxShadow: (theme) =>
        theme.palette.mode === "light"
            ? `0 8px 24px rgb(${theme.vars.palette.primary.mainChannel} / 0.04)`
            : "0 8px 24px rgba(0, 0, 0, 0.2)",
    bgcolor: "background.paper",
    display: "flex",
    flexDirection: "column",
    gap: 2.5,
};

export * from "@/components/settings-dialog/tabs/global/common/BaseTimeSettingsCard";
