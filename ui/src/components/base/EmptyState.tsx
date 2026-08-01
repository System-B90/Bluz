"use client";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import InboxIcon from "@mui/icons-material/Inbox";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

/**
 * "Nothing here yet" and "your filters excluded everything" are different
 * problems with different fixes, so they get different icons and different
 * accent colours — a user must be able to tell them apart at a glance.
 */
export type EmptyStateVariant = "empty" | "filtered";

export type EmptyStateProps = {
    variant?: EmptyStateVariant;
    message: string;
    /** Secondary line, e.g. what the call to action will do. */
    hint?: string;
    actionLabel?: string;
    onAction?: () => void;
};

export function EmptyState({
    actionLabel,
    hint,
    message,
    onAction,
    variant = "empty",
}: EmptyStateProps) {
    const Icon = variant === "filtered" ? FilterAltOffIcon : InboxIcon;

    return (
        <Box
            sx={{
                m: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                p: 3,
                textAlign: "center",
            }}
        >
            <Icon
                sx={{
                    fontSize: 40,
                    color: variant === "filtered" ? "warning.main" : "text.disabled",
                }}
            />

            <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
                {message}
            </Typography>

            {hint ? (
                <Typography sx={{ color: "text.disabled", fontSize: "0.8rem" }}>
                    {hint}
                </Typography>
            ) : null}

            {actionLabel && onAction ? (
                <Button onClick={onAction} size="small" sx={{ mt: 1 }} variant="outlined">
                    {actionLabel}
                </Button>
            ) : null}
        </Box>
    );
}
