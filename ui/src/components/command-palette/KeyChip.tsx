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
 * A chord is written modifier-first regardless of the surrounding layout.
 * `direction: "ltr"` alone doesn't guarantee that — the RTL stylis plugin
 * mirrors `flex-direction` for the whole page, caps included, so the source
 * order is reversed here to come out modifier-first once that mirroring
 * applies.
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
            {[...keys].reverse().map((key) => (
                <KeyChip key={key}>{key}</KeyChip>
            ))}
        </Box>
    );
}
