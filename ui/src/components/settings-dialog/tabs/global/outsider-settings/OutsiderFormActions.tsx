import ClearIcon from "@mui/icons-material/Clear";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

type OutsiderFormActionsProps = {
    isCreating: boolean;
    onCancel: () => void;
};

export function OutsiderFormActions({
    isCreating,
    onCancel,
}: OutsiderFormActionsProps)
{
    return (
        <Box display="flex" gap={ 1.5 } mt={ 1 }>
            <Button
                color={ isCreating ? "secondary" : "primary" }
                sx={ {
                    flex: 1,
                    borderRadius: "10px",
                    py: 1,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                } }
                type="submit"
                variant="contained"
            >
                { isCreating ? "הוספת איש חוץ" : "עדכן איש חוץ" }
            </Button>
            <Button
                color="inherit"
                onClick={ onCancel }
                startIcon={ <ClearIcon /> }
                sx={ {
                    borderRadius: "10px",
                    py: 1,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                } }
                variant="outlined"
            >
                ביטול
            </Button>
        </Box>
    );
}
