import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

export type SettingsListItemSecondaryActionProps<TEntity> = {
    item: TEntity;
    populateFormFrom: (entity: TEntity) => void;
    handleDelete: (id: string) => Promise<void>;
};

export function SettingsListItemSecondaryAction<TEntity extends { id: string; }>({ item, populateFormFrom, handleDelete }: SettingsListItemSecondaryActionProps<TEntity>)
{
    return (
        <Box alignItems="center" display="flex" gap={ 0.5 }>
            <Tooltip title="עריכה">
                <IconButton
                    edge="end"
                    onClick={ (e) =>
                    {
                        e.stopPropagation();
                        populateFormFrom(item);
                    } }
                    size="small"
                    sx={ {
                        color: "text.secondary",
                        "&:hover": { color: "primary.main" },
                    } }
                >
                    <EditIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="מחיקה">
                <IconButton
                    edge="end"
                    onClick={ (e) =>
                    {
                        e.stopPropagation();
                        void handleDelete(item.id);
                    } }
                    size="small"
                    sx={ {
                        color: "text.secondary",
                        "&:hover": { color: "error.main" },
                    } }
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
