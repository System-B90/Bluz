import ListItem, { ListItemProps } from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import { memo } from "react";

type TEntityBase = {
    id: number | string;
    name: string;
};

export type SettingsListItemProps<TEntity extends TEntityBase> = {
    item: TEntity;
    secondaryAction: React.ReactNode;
    isActive: boolean;
    itemText: {
        primary: React.ReactNode;
        secondary: React.ReactNode;
    };
} & Pick<ListItemProps, 'children' | "onClick">;

export const SettingsListItem = memo(function SettingsListItem<TEntity extends TEntityBase>({ item, isActive, secondaryAction, itemText, children, ...props }: SettingsListItemProps<TEntity>)
{
    return (
        <ListItem
            key={ item.id }
            { ...props }
            secondaryAction={ secondaryAction }
            sx={ {
                border: "1px solid",
                borderColor: isActive ? "primary.main" : "divider",
                borderRadius: "12px",
                mb: 1.5,
                p: 1.5,
                cursor: "pointer",
                bgcolor: (theme) =>
                    isActive
                        ? "action.selected"
                        : theme.palette.mode === "light"
                            ? "rgba(0,0,0,0.01)"
                            : "rgba(255,255,255,0.01)",
                transition: "all 0.2s ease",
                "&:hover": {
                    borderColor: isActive ? "primary.main" : "text.secondary",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                },
            } }
        >
            { children }
            <ListItemText
                disableTypography
                primary={ itemText.primary }
                secondary={ itemText.secondary }
            />
        </ListItem>
    );
});
