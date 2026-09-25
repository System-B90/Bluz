"use client";

/**
 * The floating assistant: a FAB pinned to the bottom of the screen that opens
 * a chat panel over the calendar or the Gantt.
 *
 * RTL throughout — the launcher and the panel are pinned with logical inset
 * properties, so they sit on the correct edge without a direction check.
 *
 * The panel renders one flat, chronological timeline. Prose, reasoning, tool
 * calls, approval cards and questions are all entries in the same list, in the
 * order the server emitted them, because a turn that reads out of order is a
 * turn the user cannot audit.
 */

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { fetchAiTools } from "@/api-client/ai";
import { apiGetPersonalSettings } from "@/api-client/personal-settings";
import { CURRICULUM_QUERY_PARAM } from "@/api-shared/types/gantt/models";
import { ApprovalCard } from "@/components/ai/ApprovalCard";
import { ChoicePrompt } from "@/components/ai/ChoicePrompt";
import { ThinkingBlock } from "@/components/ai/ThinkingBlock";
import { ToolCallChip } from "@/components/ai/ToolCallChip";
import {
    AiChatStats,
    AiTimelineItem,
    AiTimelineKind,
    useAiChat,
} from "@/components/ai/use-ai-chat";
import { useIterationScope } from "@/components/base/IterationProvider";

const PANEL_WIDTH = 420;
const PANEL_WIDTH_WIDE = 680;
/** Clears the launcher, which sits above the Gantt screen's curriculum FAB. */
const PANEL_BOTTOM = 168;
/** Stacks above the Gantt screen's curriculum FAB (bottom: 16, 56px tall). */
const LAUNCHER_BOTTOM = 88;
/**
 * How close to the bottom the user must be for a new message to scroll the
 * view. Past that, they are reading history and yanking them back down every
 * time a token arrives makes the panel unusable mid-answer.
 */
const AUTOSCROLL_SLACK_PX = 80;

const SUGGESTIONS = [
    'מה יש בלו"ז השבוע?',
    "אילו חדרים מוגדרים במחזור?",
    "תראה לי תצוגה מקדימה של גזירת הגאנט",
];

function UserBubble({ text }: { text: string }) {
    return (
        // RTL: the logical "start" (justifyContent: flex-start) is the visual
        // right, which is where the user's own messages belong.
        <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
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

// Markdown blocks (p, li, ...) already carry their own vertical rhythm, so
// margins are zeroed here and reintroduced with `& > * + *` to avoid a gap
// before the first / after the last block inside the bubble.
const MARKDOWN_SX = {
    "& > *": { margin: 0 },
    "& > * + *": { marginTop: 1 },
    "& p, & li": { fontSize: "body2.fontSize", lineHeight: 1.57 },
    "& ul, & ol": { paddingInlineStart: 3 },
    "& code": {
        bgcolor: "action.selected",
        borderRadius: 0.5,
        px: 0.5,
        fontSize: "0.85em",
    },
    "& pre": {
        bgcolor: "action.selected",
        borderRadius: 1,
        p: 1,
        overflowX: "auto",
    },
    "& pre code": { bgcolor: "transparent", px: 0 },
    "& a": { color: "primary.main" },
    "& table": { borderCollapse: "collapse", width: "100%" },
    "& th, & td": {
        border: 1,
        borderColor: "divider",
        fontSize: "0.78rem",
        px: 0.75,
        py: 0.25,
        textAlign: "start",
    },
} as const;

function AssistantBubble({ text }: { text: string }) {
    const [copied, setCopied] = React.useState(false);

    const copy = () => {
        void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "flex-start",
                // The copy button only appears on hover/focus: it is useful
                // often enough to keep, and not often enough to sit
                // permanently next to every paragraph.
                "&:hover .ai-copy, & .ai-copy:focus-visible": { opacity: 1 },
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    bgcolor: "action.hover",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: "90%",
                }}
            >
                <Box sx={MARKDOWN_SX}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {text}
                    </ReactMarkdown>
                </Box>
            </Paper>
            <Tooltip title={copied ? "הועתק" : "העתקה"}>
                <IconButton
                    aria-label="העתקת התשובה"
                    className="ai-copy"
                    onClick={copy}
                    size="small"
                    sx={{
                        alignSelf: "flex-end",
                        opacity: 0,
                        transition: "opacity 150ms",
                    }}
                >
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

function TimelineEntry({
    item,
    busy,
    isLast,
    onApprove,
    onReject,
    onAnswer,
}: {
    item: AiTimelineItem;
    busy: boolean;
    /** Only the newest reasoning block can still be streaming. */
    isLast: boolean;
    onApprove: () => void;
    onReject: () => void;
    onAnswer: (value: string) => void;
}) {
    // Computed rather than inlined in the JSX: the lint autofixer rewrites a
    // `&&` inside a prop into a ternary with a `null` branch, which this
    // boolean prop does not accept.
    const streaming = Boolean(busy && isLast);

    switch (item.kind) {
    case AiTimelineKind.User:
        return <UserBubble text={item.text} />;
    case AiTimelineKind.Assistant:
        return <AssistantBubble text={item.text} />;
    case AiTimelineKind.Thinking:
        return <ThinkingBlock streaming={streaming} text={item.text} />;
    case AiTimelineKind.Tool:
        return (
            <ToolCallChip
                detail={item.detail}
                durationMs={item.durationMs}
                state={item.state}
                summary={item.summary}
                title={item.title}
            />
        );
    case AiTimelineKind.Approval:
        return (
            <ApprovalCard
                args={item.arguments}
                busy={busy}
                danger={item.danger}
                impact={item.impact}
                onApprove={onApprove}
                onReject={onReject}
                state={item.state}
                summary={item.summary}
                title={item.title}
            />
        );
    case AiTimelineKind.Choice:
        return (
            <ChoicePrompt
                allowFreeText={item.allowFreeText}
                answer={item.answer}
                busy={busy}
                onAnswer={onAnswer}
                options={item.options}
                question={item.question}
            />
        );
    case AiTimelineKind.Failure:
        return <Alert severity="error">{item.message}</Alert>;
    }
}

/** Model and cumulative token cost, so the bill is never invisible. */
function StatsFooter({ stats }: { stats: AiChatStats }) {
    if (!stats.model) return null;
    return (
        <Tooltip
            title={
                stats.usage
                    ? `קלט ${stats.usage.promptTokens} · פלט ${stats.usage.completionTokens}`
                    : ""
            }
        >
            <Typography color="text.disabled" variant="caption">
                {stats.model}
                {stats.usage ? ` · ${stats.usage.totalTokens} טוקנים` : ""}
            </Typography>
        </Tooltip>
    );
}

export function AiAssistant() {
    const [open, setOpen] = React.useState(false);
    const [wide, setWide] = React.useState(false);
    const [enabled, setEnabled] = React.useState<boolean | null>(null);
    const [userEnabled, setUserEnabled] = React.useState(true);
    const [draft, setDraft] = React.useState("");
    const { iterationId } = useIterationScope();
    // The Gantt screen keeps the open curriculum in `?gc=`, so the assistant
    // picks up "this gantt" from the URL instead of being threaded a prop
    // through every screen that might host it.
    const curriculumId =
        useSearchParams().get(CURRICULUM_QUERY_PARAM) ?? undefined;

    const {
        timeline,
        busy,
        stats,
        pendingApproval,
        pendingChoice,
        send,
        approve,
        reject,
        answerChoice,
        stop,
        reset,
    } = useAiChat({ iterationId, curriculumId });

    const scrollRef = React.useRef<HTMLDivElement>(null);
    // Tracked on scroll rather than read during the effect: by the time the
    // new content has rendered, the measurement that decides whether to follow
    // it is already contaminated by the content itself.
    const followRef = React.useRef(true);

    // A deployment with no API key must not advertise a launcher that fails on
    // first use, so the capability is probed once per mount.
    React.useEffect(() => {
        let cancelled = false;
        void fetchAiTools()
            .then((result) => {
                if (!cancelled) setEnabled(result.enabled);
            })
            .catch(() => {
                // Transient probe failure (e.g. a 5xx) — leave `enabled` at
                // its current value rather than treating a blip as "not
                // configured".
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Personal setting: lets a user hide the FAB without an admin toggling
    // the deployment-wide key.
    React.useEffect(() => {
        let cancelled = false;
        void apiGetPersonalSettings({}).then((settings) => {
            if (!cancelled) setUserEnabled(settings.aiAssistantEnabled);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        if (!followRef.current) return;
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [timeline]);

    // Esc closes the panel, the convention every other overlay here follows.
    React.useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const submit = () => {
        send(draft);
        setDraft("");
    };

    if (!enabled || !userEnabled) return null;

    // A turn that stopped on a question or an approval is not "thinking" — it
    // is waiting on the user, and a spinner there reads as a hung panel.
    const waiting = Boolean(pendingApproval || pendingChoice);

    return (
        <>
            <Tooltip placement="left" title='עוזר AI ללו"ז ולגאנט'>
                <Fab
                    aria-label="ai-assistant"
                    color="primary"
                    onClick={() => setOpen((value) => !value)}
                    sx={{
                        position: "fixed",
                        bottom: LAUNCHER_BOTTOM,
                        insetInlineEnd: 16,
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
                        width: {
                            xs: "calc(100vw - 48px)",
                            sm: wide ? PANEL_WIDTH_WIDE : PANEL_WIDTH,
                        },
                        maxWidth: "calc(100vw - 48px)",
                        maxHeight: `calc(100vh - ${PANEL_BOTTOM + 48}px)`,
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 3,
                        overflow: "hidden",
                        transition: "width 180ms",
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
                        <Typography variant="subtitle2">עוזר בלוז</Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <StatsFooter stats={stats} />
                        <Tooltip title={wide ? "הקטנה" : "הרחבה"}>
                            <IconButton
                                aria-label={wide ? "הקטנת החלון" : "הרחבת החלון"}
                                onClick={() => setWide((value) => !value)}
                                size="small"
                                sx={{ display: { xs: "none", sm: "inline-flex" } }}
                            >
                                {wide ? (
                                    <CloseFullscreenIcon fontSize="small" />
                                ) : (
                                    <OpenInFullIcon fontSize="small" />
                                )}
                            </IconButton>
                        </Tooltip>
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
                        onScroll={(event) => {
                            const element = event.currentTarget;
                            followRef.current =
                                element.scrollHeight -
                                    element.scrollTop -
                                    element.clientHeight <
                                AUTOSCROLL_SLACK_PX;
                        }}
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
                                timeline.map((item, index) => (
                                    <TimelineEntry
                                        busy={busy}
                                        isLast={index === timeline.length - 1}
                                        item={item}
                                        key={item.id}
                                        onAnswer={answerChoice}
                                        onApprove={approve}
                                        onReject={reject}
                                    />
                                ))
                            )}

                            {busy && !waiting ? (
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
