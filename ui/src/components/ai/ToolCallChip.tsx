"use client";

/**
 * One tool call, as a line in the conversation.
 *
 * Deliberately not a bubble: a tool call is something the assistant *did*, not
 * something it said, and giving it the same weight as prose makes a three-step
 * answer unreadable. It stays one quiet line — friendly name, outcome, how
 * long it took — that opens into the exact envelope the model received when
 * someone wants to know why the assistant believes what it says.
 */

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

import { AiToolState } from "@/components/ai/use-ai-chat";

/** Height cap on the opened payload, which can be a few hundred lines. */
const MAX_DETAIL_HEIGHT = 200;

/** Sub-second calls round to "0.1 שנ׳" rather than showing a bare "0". */
function formatDuration(durationMs: number): string {
    return durationMs < 950
        ? `${Math.max(0.1, durationMs / 1000).toFixed(1)} שנ׳`
        : `${Math.round(durationMs / 1000)} שנ׳`;
}

function StateIcon({ state }: { state: AiToolState }) {
    switch (state) {
    case AiToolState.Running:
        return <CircularProgress size={13} />;
    case AiToolState.Failed:
        return <ErrorOutlineIcon color="error" sx={{ fontSize: 16 }} />;
    case AiToolState.Ok:
        return <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />;
    }
}

export function ToolCallChip({
    title,
    summary,
    state,
    durationMs,
    detail,
}: {
    title: string;
    summary: string;
    state: AiToolState;
    durationMs?: number;
    detail?: unknown;
}) {
    const [open, setOpen] = React.useState(false);
    const expandable = detail !== undefined;

    const header = (
        <Stack
            alignItems="center"
            direction="row"
            spacing={1}
            sx={{ minWidth: 0, width: "100%" }}
        >
            <StateIcon state={state} />
            <Typography
                sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
                variant="caption"
            >
                {title}
            </Typography>
            <Typography
                color={state === AiToolState.Failed ? "error" : "text.secondary"}
                sx={{
                    flexGrow: 1,
                    overflow: "hidden",
                    textAlign: "start",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
                variant="caption"
            >
                {summary}
            </Typography>
            {durationMs !== undefined ? (
                <Typography color="text.disabled" variant="caption">
                    {formatDuration(durationMs)}
                </Typography>
            ) : null}
            {expandable ? (
                <ExpandMoreIcon
                    sx={{
                        color: "text.disabled",
                        fontSize: 16,
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform 150ms",
                    }}
                />
            ) : null}
        </Stack>
    );

    return (
        <Box
            sx={{
                bgcolor: "action.hover",
                borderRadius: 1.5,
                px: 1,
                py: 0.5,
                width: "100%",
            }}
        >
            {expandable ? (
                <ButtonBase
                    aria-expanded={open}
                    onClick={() => setOpen((value) => !value)}
                    sx={{ borderRadius: 1, px: 0.5, py: 0.25, width: "100%" }}
                >
                    {header}
                </ButtonBase>
            ) : (
                <Box sx={{ px: 0.5, py: 0.25 }}>{header}</Box>
            )}

            <Collapse in={open} unmountOnExit>
                <Box
                    component="pre"
                    dir="ltr"
                    sx={{
                        // LTR and monospace on purpose: this is JSON, and
                        // rendering it in the page's RTL flow scrambles
                        // brackets and punctuation into nonsense.
                        bgcolor: "background.default",
                        borderRadius: 1,
                        fontSize: "0.7rem",
                        m: 0,
                        maxHeight: MAX_DETAIL_HEIGHT,
                        mt: 0.5,
                        overflow: "auto",
                        p: 1,
                    }}
                >
                    {JSON.stringify(detail, null, 2)}
                </Box>
            </Collapse>
        </Box>
    );
}
