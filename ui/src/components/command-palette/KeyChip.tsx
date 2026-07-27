"use client";
import Box from "@mui/material/Box";
import type { ReactNode } from "react";

export type KeyChipProps = {
    children: ReactNode;
};

/** A single keycap. */
export function KeyChip({ children }: KeyChipProps) {
    return (
        <Box
            component="kbd"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 20,
                height: 20,
                px: 0.625,
                borderRadius: "5px",
                border: "1px solid",
                borderColor: "divider",
                borderBottomWidth: 2,
                bgcolor: "background.paper",
                fontFamily: "inherit",
                fontSize: "0.68rem",
                fontWeight: 600,
                lineHeight: 1,
                color: "text.secondary",
                whiteSpace: "nowrap",
            }}
        >
            {children}
        </Box>
    );
}

export type ShortcutKeysProps = {
    keys: Array<string>;
};

/**
 * A key sequence such as `Ctrl` `Z`.
 *
 * The container pins itself to `ltr` because a chord is written modifier-first
 * regardless of the surrounding layout — inheriting an RTL direction would flex
 * the caps into reverse order and render it as `Z` `Ctrl`.
 */
export function ShortcutKeys({ keys }: ShortcutKeysProps) {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.375,
                flexShrink: 0,
                direction: "ltr",
            }}
        >
            {keys.map((key) => (
                <KeyChip key={key}>{key}</KeyChip>
            ))}
        </Box>
    );
}
