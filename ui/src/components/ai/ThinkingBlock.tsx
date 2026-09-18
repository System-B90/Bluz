"use client";

/**
 * The model's private reasoning, collapsed.
 *
 * It is the difference between trusting an answer and taking it on faith, so
 * it must be *available* — and it is also several hundred words of the model
 * talking to itself, so it must not be what the user reads by default. Hence a
 * one-line summary that opens on demand, and never auto-opens: a block that
 * expanded itself mid-stream would shove the answer off-screen every turn.
 */

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PsychologyIcon from "@mui/icons-material/Psychology";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import React from "react";

/** Height cap on the opened block, so a long ramble stays scrollable. */
const MAX_HEIGHT = 220;

export function ThinkingBlock({
    text,
    streaming,
}: {
    text: string;
    /** Drives the "still thinking" wording and the pulsing icon. */
    streaming: boolean;
}) {
    const [open, setOpen] = React.useState(false);

    return (
        <Box sx={{ alignSelf: "flex-start", width: "100%" }}>
            <ButtonBase
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                sx={{
                    borderRadius: 1,
                    color: "text.secondary",
                    gap: 0.75,
                    px: 0.5,
                    py: 0.25,
                    "&:hover": { bgcolor: "action.hover" },
                }}
            >
                <PsychologyIcon
                    fontSize="small"
                    sx={{
                        // A static icon next to "חושב…" reads as a stalled
                        // panel; the pulse is the only signal that the stream
                        // is alive while no text is arriving.
                        animation: streaming
                            ? "ai-think-pulse 1.4s ease-in-out infinite"
                            : "none",
                        "@keyframes ai-think-pulse": {
                            "0%, 100%": { opacity: 0.4 },
                            "50%": { opacity: 1 },
                        },
                    }}
                />
                <Typography variant="caption">
                    {streaming ? "חושב…" : "תהליך החשיבה"}
                </Typography>
                <ExpandMoreIcon
                    fontSize="small"
                    sx={{
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform 150ms",
                    }}
                />
            </ButtonBase>

            <Collapse in={open} unmountOnExit>
                <Box
                    sx={{
                        borderInlineStart: 2,
                        borderColor: "divider",
                        color: "text.secondary",
                        maxHeight: MAX_HEIGHT,
                        mt: 0.5,
                        overflowY: "auto",
                        paddingInlineStart: 1.5,
                        whiteSpace: "pre-wrap",
                    }}
                >
                    <Typography variant="caption">{text}</Typography>
                </Box>
            </Collapse>
        </Box>
    );
}
