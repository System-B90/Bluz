import ClearIcon from "@mui/icons-material/Clear";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { ReactNode } from "react";

export type SettingsFormActionsProps = {
    submitLabel: string;
    submitColor?: "primary" | "secondary";
    onCancel: () => void;
    /** Disables submit and swaps its icon for a spinner. */
    isSubmitting?: boolean;
    /**
     * Tab-specific extras (the iteration Hive sync, for one). Rendered as
     * low-emphasis buttons after submit/cancel so the two standard buttons
     * always sit in the same place, whatever a tab adds.
     */
    extraActions?: ReactNode;
};

const actionButtonSx = {
    borderRadius: "10px",
    py: 1,
    fontWeight: 700,
    fontSize: "0.82rem",
} as const;

/**
 * The action row shared by every settings edit panel: a filled submit button
 * that stretches, then "ביטול", then any tab-specific extras. Placement,
 * colours and the cancel wording are fixed here on purpose — tabs pass labels,
 * not layout.
 */
export function SettingsFormActions({
    submitLabel,
    submitColor = "primary",
    onCancel,
    isSubmitting = false,
    extraActions,
}: SettingsFormActionsProps)
{
    return (
        <Box display="flex" gap={ 1.5 } mt={ 1 }>
            <Button
                color={ submitColor }
                disabled={ isSubmitting }
                startIcon={ isSubmitting
                    ? <CircularProgress size={ 16 } />
                    : undefined }
                sx={ {
                    ...actionButtonSx,
                    flex: 1,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                } }
                type="submit"
                variant="contained"
            >
                { submitLabel }
            </Button>
            <Button
                color="inherit"
                onClick={ onCancel }
                startIcon={ <ClearIcon /> }
                sx={ actionButtonSx }
                type="button"
                variant="outlined"
            >
                ביטול
            </Button>
            { extraActions }
        </Box>
    );
}
