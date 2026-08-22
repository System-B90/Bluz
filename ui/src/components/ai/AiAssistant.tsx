"use client";

/**
 * The floating assistant: a FAB pinned to the bottom of the screen that opens
 * a chat panel over the calendar or the Gantt.
 *
 * RTL throughout — the launcher and the panel are pinned with logical inset
 * properties, so they sit on the correct edge without a direction check.
 */

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSearchParams } from "next/navigation";
import React from "react";

import { fetchAiTools } from "@/api-client/ai";
import {
    AiTimelineItem,
    AiTimelineKind,
    useAiChat,
} from "@/components/ai/use-ai-chat";
import { useIterationScope } from "@/components/base/IterationProvider";

const PANEL_WIDTH = 420;
/** Clears the launcher and the offline FAB, which share the bottom row. */
const PANEL_BOTTOM = 96;

const SUGGESTIONS = [
    'מה יש בלו"ז השבוע?',
    "אילו חדרים מוגדרים במחזור?",
    "תראה לי תצוגה מקדימה של גזירת הגאנט",
];

function UserBubble({ text }: { text: string }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Paper
                elevation={0}
                sx={{
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: "85%",
                    whiteSpace: "pre-wrap",
                }}
            >
                <Typography variant="body2">{text}</Typography>
            </Paper>
        </Box>
    );
}

function AssistantBubble({ text }: { text: string }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
            <Paper
                elevation={0}
                sx={{
                    bgcolor: "action.hover",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: "90%",
                    whiteSpace: "pre-wrap",
                }}
            >
                <Typography variant="body2">{text}</Typography>
            </Paper>
        </Box>
    );
}

function ToolChip({
    name,
    summary,
    state,
}: {
    name: string;
    summary: string;
    state: "failed" | "ok" | "running";
}) {
    return (
        <Chip
            color={state === "failed" ? "error" : "default"}
            icon={
                state === "running" ? (
                    <CircularProgress size={12} sx={{ marginInlineStart: 1 }} />
                ) : state === "failed" ? (
                    <ErrorOutlineIcon />
                ) : (
                    <CheckIcon />
                )
            }
            label={`${name}: ${summary}`}
            size="small"
            sx={{ alignSelf: "flex-start", maxWidth: "100%" }}
            variant="outlined"
        />
    );
}

function TimelineEntry({ item }: { item: AiTimelineItem }) {
    switch (item.kind) {
    case AiTimelineKind.User:
        return <UserBubble text={item.text} />;
    case AiTimelineKind.Assistant:
        return <AssistantBubble text={item.text} />;
    case AiTimelineKind.Tool:
        return (
            <ToolChip
                name={item.name}
                state={item.state}
                summary={item.summary}
            />
        );
    }
}

export function AiAssistant() {
    const [open, setOpen] = React.useState(false);
    const [enabled, setEnabled] = React.useState<boolean | null>(null);
    const [draft, setDraft] = React.useState("");
    const { iterationId } = useIterationScope();
    // The Gantt screen keeps the open curriculum in `?cid=`, so the assistant
    // picks up "this gantt" from the URL instead of being threaded a prop
    // through every screen that might host it.
    const curriculumId = useSearchParams().get("cid") ?? undefined;

    const {
        timeline,
        busy,
        error,
        pendingApproval,
        send,
        approve,
        reject,
        stop,
        reset,
    } = useAiChat({ iterationId, curriculumId });

    const scrollRef = React.useRef<HTMLDivElement>(null);

    // A deployment with no API key must not advertise a launcher that fails on
    // first use, so the capability is probed once per mount.
    React.useEffect(() => {
        let cancelled = false;
        void fetchAiTools().then((result) => {
            if (!cancelled) setEnabled(result.enabled);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [timeline, pendingApproval]);

    const submit = () => {
        send(draft);
        setDraft("");
    };

    if (!enabled) return null;

    return (
        <>
            <Tooltip placement="left" title='עוזר AI ללו"ז ולגאנט'>
                <Fab
                    aria-label="ai-assistant"
                    color="primary"
                    onClick={() => setOpen((value) => !value)}
                    sx={{
                        position: "fixed",
                        bottom: 24,
                        insetInlineEnd: 24,
                        zIndex: 1200,
                    }}
                >
                    {open ? <CloseIcon /> : <AutoAwesomeIcon />}
                </Fab>
            </Tooltip>

            {open ? (
                <Paper
                    elevation={8}
                    sx={{
                        position: "fixed",
                        bottom: PANEL_BOTTOM,
                        insetInlineEnd: 24,
                        width: { xs: "calc(100vw - 48px)", sm: PANEL_WIDTH },
                        maxHeight: `calc(100vh - ${PANEL_BOTTOM + 48}px)`,
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 3,
                        overflow: "hidden",
                        zIndex: 1200,
                    }}
                >
                    <Stack
                        alignItems="center"
                        direction="row"
                        spacing={1}
                        sx={{ px: 2, py: 1.5, bgcolor: "background.paper" }}
                    >
                        <AutoAwesomeIcon color="primary" fontSize="small" />
                        <Typography sx={{ flexGrow: 1 }} variant="subtitle2">
                            עוזר בלוז
                        </Typography>
                        <Tooltip title="שיחה חדשה">
                            <span>
                                <IconButton
                                    aria-label="שיחה חדשה"
                                    disabled={busy || timeline.length === 0}
                                    onClick={reset}
                                    size="small"
                                >
                                    <DeleteSweepIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>

                    <Box
                        ref={scrollRef}
                        sx={{
                            flexGrow: 1,
                            overflowY: "auto",
                            px: 2,
                            py: 1,
                            minHeight: 180,
                        }}
                    >
                        <Stack spacing={1}>
                            {timeline.length === 0 ? (
                                <Stack spacing={1} sx={{ py: 2 }}>
                                    <Typography
                                        color="text.secondary"
                                        variant="body2"
                                    >
                                        שאל אותי על הלו&quot;ז או על הגאנט. אני
                                        יכול גם לבצע שינויים — כל שינוי יוצג
                                        לאישור שלך לפני שהוא מתבצע.
                                    </Typography>
                                    {SUGGESTIONS.map((suggestion) => (
                                        <Chip
                                            clickable
                                            key={suggestion}
                                            label={suggestion}
                                            onClick={() => send(suggestion)}
                                            size="small"
                                            sx={{ alignSelf: "flex-start" }}
                                            variant="outlined"
                                        />
                                    ))}
                                </Stack>
                            ) : (
                                timeline.map((item) => (
                                    <TimelineEntry item={item} key={item.id} />
                                ))
                            )}

                            {pendingApproval ? (
                                <Alert
                                    action={
                                        <Stack direction="row" spacing={1}>
                                            <Button
                                                color="inherit"
                                                disabled={busy}
                                                onClick={reject}
                                                size="small"
                                            >
                                                ביטול
                                            </Button>
                                            <Button
                                                color="warning"
                                                disabled={busy}
                                                onClick={approve}
                                                size="small"
                                                variant="contained"
                                            >
                                                אישור
                                            </Button>
                                        </Stack>
                                    }
                                    severity="warning"
                                    sx={{ alignItems: "center" }}
                                >
                                    <Typography variant="body2">
                                        {pendingApproval.summary}
                                    </Typography>
                                </Alert>
                            ) : null}

                            {busy && !pendingApproval ? (
                                // The backing model reasons before it emits any
                                // visible text, so without this the panel sits
                                // blank for seconds after a question.
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    spacing={1}
                                    sx={{ color: "text.secondary", px: 0.5 }}
                                >
                                    <CircularProgress size={12} />
                                    <Typography variant="caption">
                                        חושב…
                                    </Typography>
                                </Stack>
                            ) : null}

                            {error ? (
                                <Alert severity="error">{error}</Alert>
                            ) : null}
                        </Stack>
                    </Box>

                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ p: 1.5, borderTop: 1, borderColor: "divider" }}
                    >
                        <TextField
                            disabled={busy}
                            fullWidth
                            maxRows={4}
                            multiline
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                // Enter sends; Shift+Enter is a newline, the
                                // convention every chat input here follows.
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    submit();
                                }
                            }}
                            placeholder="שאל שאלה או בקש שינוי…"
                            size="small"
                            value={draft}
                        />
                        {busy ? (
                            <Tooltip title="עצור">
                                <IconButton
                                    aria-label="עצירת התשובה"
                                    color="error"
                                    onClick={stop}
                                >
                                    <StopIcon />
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <IconButton
                                aria-label="שליחת ההודעה"
                                color="primary"
                                disabled={!draft.trim()}
                                onClick={submit}
                            >
                                <SendIcon sx={{ transform: "scaleX(-1)" }} />
                            </IconButton>
                        )}
                    </Stack>
                </Paper>
            ) : null}
        </>
    );
}
