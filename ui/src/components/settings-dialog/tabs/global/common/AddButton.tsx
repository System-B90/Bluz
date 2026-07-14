import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";

export type SettingsAddButtonProps = {
    label: string;
    onClick: () => void;
};

export function SettingsAddButton({ label, onClick }: SettingsAddButtonProps)
{
    return (
        <Button
            color="secondary"
            onClick={ onClick }
            startIcon={ <AddIcon className="me-1" /> }
            sx={ {
                borderRadius: "10px",
                py: 1,
                fontWeight: 700,
                fontSize: "0.82rem",
                boxShadow: "0 4px 12px rgb(var(--mui-palette-secondary-mainChannel) / 0.1)",
                transition: "all 0.2s ease",
                "&:hover": {
                    transform: "translateY(-1px)",
                    boxShadow: "0 6px 16px rgb(var(--mui-palette-secondary-mainChannel) / 0.2)",
                },
            } }
            variant="contained"
        >
            { label }
        </Button>
    );
}
