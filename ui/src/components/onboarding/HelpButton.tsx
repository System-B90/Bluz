"use client";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import IconButton, { IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import { useOnboarding } from "@/components/onboarding/use-onboarding";

/**
 * The "?" affordance. Opens the help panel; entirely optional — a host app is
 * free to call `openHelp()` from its own menu instead.
 */
export function HelpButton(props: IconButtonProps) {
    const { labels, openHelp } = useOnboarding();

    return (
        <Tooltip title={labels.help.title}>
            <IconButton
                aria-label={labels.help.openAria}
                color="inherit"
                onClick={openHelp}
                size="small"
                {...props}
            >
                <HelpOutlineIcon color="inherit" fontSize="small" />
            </IconButton>
        </Tooltip>
    );
}
