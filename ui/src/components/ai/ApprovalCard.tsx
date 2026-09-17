"use client";

/**
 * The approval gate, rendered where it happened in the conversation.
 *
 * Two rules drive the design. First, the card sits inline in the timeline, not
 * in a floating bar: the user has to be able to read the messages that led to
 * the request while deciding on it, and scroll back to a decision afterwards
 * and see what it was. Second, a destructive call takes two clicks — the
 * second one labelled with what is about to be destroyed — because the cost of
 * one stray click on "מחיקת אירוע" is not recoverable from the chat.
 */

import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";

import { AiToolDanger } from "@/api-shared/types/ai";
import { AiApprovalState } from "@/components/ai/use-ai-chat";

/** Per-severity presentation. Colour is never the only signal — wording is. */
const DANGER_STYLE: Record<
    AiToolDanger,
    { color: "error" | "info" | "warning"; label: string; confirm: string }
> = {
    [AiToolDanger.Safe]: {
        color: "info",
        label: "פעולה בטוחה",
        confirm: "אישור",
    },
    [AiToolDanger.Caution]: {
        color: "warning",
        label: "משנה נתונים",
        confirm: "אישור",
    },
    [AiToolDanger.Destructive]: {
        color: "error",
        label: "פעולה הרסנית",
        confirm: "כן, בצע",
    },
};

function DangerIcon({ danger }: { danger: AiToolDanger }) {
    return danger === AiToolDanger.Destructive ? (
        <DeleteForeverIcon color="error" fontSize="small" />
    ) : danger === AiToolDanger.Caution ? (
        <EditIcon color="warning" fontSize="small" />
    ) : (
        <WarningAmberIcon color="info" fontSize="small" />
    );
}

/** The settled card: a record of what was decided, with no live controls. */
function SettledNotice({ state }: { state: AiApprovalState }) {
    const approved = state === AiApprovalState.Approved;
    return (
        <Chip
            color={approved ? "success" : "default"}
            label={approved ? "אושר על ידך" : "נדחה על ידך"}
            size="small"
            variant="outlined"
        />
    );
}

export function ApprovalCard({
    title,
    danger,
    summary,
    impact,
    args,
    state,
    busy,
    onApprove,
    onReject,
}: {
    title: string;
    danger: AiToolDanger;
    summary: string;
    impact: Array<string>;
    args: unknown;
    state: AiApprovalState;
    busy: boolean;
    onApprove: () => void;
    onReject: () => void;
}) {
    const [showArgs, setShowArgs] = React.useState(false);
    // Only ever true for a destructive call: the first click arms, the second
    // executes. Reset by a reject so an abandoned card cannot stay armed.
    const [armed, setArmed] = React.useState(false);

    const style = DANGER_STYLE[danger];
    const pending = state === AiApprovalState.Pending;
    const needsArming = danger === AiToolDanger.Destructive && !armed;

    return (
        <Paper
            elevation={0}
            sx={{
                borderColor: `${style.color}.main`,
                borderRadius: 2,
                borderStyle: "solid",
                borderWidth: 1,
                // A tint derived from the severity colour, so the card reads
                // as urgent in both themes without hard-coding a light shade
                // that turns unreadable in the dark one.
                bgcolor: (theme) =>
                    alpha(
                        theme.palette[style.color].main,
                        theme.palette.mode === "dark" ? 0.12 : 0.08,
                    ),
                opacity: pending ? 1 : 0.75,
                p: 1.5,
                width: "100%",
            }}
        >
            <Stack spacing={1}>
                <Stack alignItems="center" direction="row" spacing={1}>
                    <DangerIcon danger={danger} />
                    <Typography sx={{ fontWeight: 600 }} variant="body2">
                        {title}
                    </Typography>
                    <Chip
                        color={style.color}
                        label={style.label}
                        size="small"
                        sx={{ height: 20 }}
                        variant="outlined"
                    />
                </Stack>

                <Typography variant="body2">{summary}</Typography>

                {impact.length ? (
                    <Box
                        component="ul"
                        sx={{
                            color: "text.secondary",
                            m: 0,
                            paddingInlineStart: 2.5,
                        }}
                    >
                        {impact.map((line) => (
                            <Typography
                                component="li"
                                key={line}
                                variant="caption"
                            >
                                {line}
                            </Typography>
                        ))}
                    </Box>
                ) : null}

                <Box>
                    <ButtonBase
                        aria-expanded={showArgs}
                        onClick={() => setShowArgs((value) => !value)}
                        sx={{
                            borderRadius: 1,
                            color: "text.secondary",
                            gap: 0.5,
                            px: 0.5,
                        }}
                    >
                        <Typography variant="caption">
                            הפרטים המלאים
                        </Typography>
                        <ExpandMoreIcon
                            sx={{
                                fontSize: 16,
                                transform: showArgs ? "rotate(180deg)" : "none",
                                transition: "transform 150ms",
                            }}
                        />
                    </ButtonBase>
                    <Collapse in={showArgs} unmountOnExit>
                        <Box
                            component="pre"
                            dir="ltr"
                            sx={{
                                bgcolor: "background.default",
                                borderRadius: 1,
                                fontSize: "0.7rem",
                                m: 0,
                                mt: 0.5,
                                overflow: "auto",
                                p: 1,
                            }}
                        >
                            {JSON.stringify(args, null, 2)}
                        </Box>
                    </Collapse>
                </Box>

                {pending ? (
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Button
                            color="inherit"
                            disabled={busy}
                            onClick={() => {
                                setArmed(false);
                                onReject();
                            }}
                            size="small"
                        >
                            ביטול
                        </Button>
                        <Button
                            color={style.color}
                            disabled={busy}
                            onClick={() =>
                                needsArming ? setArmed(true) : onApprove()
                            }
                            size="small"
                            variant="contained"
                        >
                            {needsArming ? "אישור" : style.confirm}
                        </Button>
                    </Stack>
                ) : (
                    <Box sx={{ alignSelf: "flex-end" }}>
                        <SettledNotice state={state} />
                    </Box>
                )}
            </Stack>
        </Paper>
    );
}
