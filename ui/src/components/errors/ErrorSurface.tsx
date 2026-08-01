"use client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import React from "react";

export type ErrorSurfaceAction = {
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: "contained" | "outlined" | "text";
};

export type ErrorSurfaceProps = {
    title: string;
    description: string;
    /** Short technical hint (digest / message). Rendered monospace, muted. */
    details?: string;
    actions?: Array<ErrorSurfaceAction>;
};

/**
 * The single visual for every full-page failure surface: segment errors, 404s
 * and the global crash page. Keeping one component means the RTL Hebrew copy,
 * spacing and theme tokens stay identical across all of them.
 */
export function ErrorSurface({
    actions = [],
    description,
    details,
    title,
}: ErrorSurfaceProps) {
    return (
        <Box
            alignItems="center"
            bgcolor="background.default"
            display="flex"
            flexDirection="column"
            gap={2}
            height="100%"
            justifyContent="center"
            minHeight="60vh"
            p={4}
            textAlign="center"
            width="100%"
        >
            <Typography color="textPrimary" component="h1" variant="h4">
                {title}
            </Typography>

            <Typography color="textSecondary" component="p" maxWidth="42rem">
                {description}
            </Typography>

            {details ? (
                <Typography
                    color="text.secondary"
                    component="p"
                    fontFamily="monospace"
                    fontSize={12}
                    sx={{ direction: "ltr", wordBreak: "break-word" }}
                >
                    {details}
                </Typography>
            ) : null}

            {actions.length > 0 ? (
                <Box display="flex" flexWrap="wrap" gap={2} justifyContent="center" mt={2}>
                    {actions.map((action) => (
                        <Button
                            href={action.href}
                            key={action.label}
                            onClick={action.onClick}
                            variant={action.variant ?? "outlined"}
                        >
                            {action.label}
                        </Button>
                    ))}
                </Box>
            ) : null}
        </Box>
    );
}
