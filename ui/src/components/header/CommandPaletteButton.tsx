"use client";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useSyncExternalStore } from "react";

import { ShortcutKeys, useCommandPalette } from "@/components/command-palette";

/** The platform never changes mid-session, so there is nothing to subscribe to. */
const noopSubscribe = () => () => {};

/**
 * The mouse affordance for the command palette: a VSCode-style centred quick
 * input bar, styled as a Bluz search pill.
 *
 * Collapses to a plain icon button below `sm`, where there is no room for the
 * hint text.
 */
export function CommandPaletteButton() {
    const { open } = useCommandPalette();
    // Resolved on the client only: the server has no idea what the user is on,
    // so it renders the non-Mac hint and hydration corrects it if needed.
    const isMac = useSyncExternalStore(
        noopSubscribe,
        () => /mac/i.test(window.navigator.userAgent),
        () => false,
    );

    return (
        <ButtonBase
            aria-label="פתיחת שורת הפקודות"
            onClick={() => open(null)}
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: { xs: 1, sm: 2 },
                py: 0.5,
                minWidth: { xs: "auto", sm: 320 },
                maxWidth: 480,
                borderRadius: "10px",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "action.hover",
                color: "text.secondary",
                transition: "all 0.2s ease",
                "&:hover": {
                    bgcolor: "action.selected",
                    borderColor: "primary.main",
                },
            }}
        >
            <SearchIcon fontSize="small" />

            <Typography
                noWrap
                sx={{
                    display: { xs: "none", sm: "block" },
                    flexGrow: 1,
                    textAlign: "start",
                    fontSize: "0.85rem",
                }}
            >
                חיפוש פקודה או פריט
            </Typography>

            <Box sx={{ display: { xs: "none", sm: "flex" } }}>
                <ShortcutKeys keys={isMac ? ["⌘", "K"] : ["Ctrl", "K"]} />
            </Box>
        </ButtonBase>
    );
}
