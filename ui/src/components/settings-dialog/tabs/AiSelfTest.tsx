"use client";

/**
 * "בדוק את הסוכן שלי" — the AI self-test, in Personal Settings (#704).
 *
 * Today a user whose deployment points at a weak or misconfigured model has
 * exactly one signal: the assistant "feels dumber". This runs a fixed suite
 * against fabricated data and says which specific behaviours held — it called
 * the right tool, it noticed the planned-vs-actual gap, it did not delete
 * anything without asking — and which did not.
 *
 * There is deliberately no overall "good model / bad model" verdict: what is
 * good enough depends on the deployment, and a badge claiming otherwise would
 * be a promise this cannot keep. The score is per check.
 */

import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ScienceIcon from "@mui/icons-material/Science";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

import { fetchAiBenchmarkJob, startAiBenchmark } from "@/api-client/ai";
import {
    AiBenchmarkCase,
    AiBenchmarkJob,
    AiBenchmarkJobStatus,
    AiBenchmarkResult,
} from "@/api-shared/types/ai-benchmark";

const POLL_INTERVAL_MS = 3_000;

function CaseRow({ entry }: { entry: AiBenchmarkCase }) {
    const [open, setOpen] = React.useState(false);
    const passed = entry.checks.filter((check) => check.passed).length;
    const allPassed = passed === entry.checks.length;

    return (
        <Box sx={ { borderRadius: 1, bgcolor: "action.hover", px: 1, py: 0.5 } }>
            <ButtonBase
                aria-expanded={ open }
                onClick={ () => setOpen((value) => !value) }
                sx={ { borderRadius: 1, px: 0.5, py: 0.5, width: "100%" } }
            >
                <Stack alignItems="center" direction="row" spacing={ 1 } sx={ { width: "100%" } }>
                    { allPassed
                        ? <CheckCircleIcon color="success" sx={ { fontSize: 18 } } />
                        : <CancelIcon color="error" sx={ { fontSize: 18 } } /> }
                    <Typography sx={ { flexGrow: 1, textAlign: "start" } } variant="body2">
                        { entry.title }
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                        { passed }/{ entry.checks.length }
                    </Typography>
                    <ExpandMoreIcon
                        sx={ {
                            color: "text.disabled",
                            fontSize: 18,
                            transform: open ? "rotate(180deg)" : "none",
                            transition: "transform 150ms",
                        } }
                    />
                </Stack>
            </ButtonBase>

            <Collapse in={ open } unmountOnExit>
                <Stack spacing={ 0.5 } sx={ { px: 1, py: 1 } }>
                    <Typography color="text.secondary" variant="caption">
                        הנחיה: { entry.prompt }
                    </Typography>
                    { entry.checks.map((check) => (
                        <Stack alignItems="flex-start" direction="row" key={ check.label } spacing={ 1 }>
                            { check.passed
                                ? <CheckCircleIcon color="success" sx={ { fontSize: 15, mt: "2px" } } />
                                : <CancelIcon color="error" sx={ { fontSize: 15, mt: "2px" } } /> }
                            <Box>
                                <Typography variant="caption">{ check.label }</Typography>
                                { check.detail
                                    ? <Typography color="error" sx={ { display: "block" } } variant="caption">
                                        { check.detail }
                                    </Typography>
                                    : null }
                            </Box>
                        </Stack>
                    )) }
                    { entry.toolCalls.length
                        ? <Typography color="text.secondary" variant="caption">
                            כלים שנקראו: { entry.toolCalls.join(" ← ") }
                        </Typography>
                        : null }
                    { entry.answer
                        ? <Typography
                            sx={ { bgcolor: "background.default", borderRadius: 1, p: 1, whiteSpace: "pre-wrap" } }
                            variant="caption"
                        >
                            { entry.answer }
                        </Typography>
                        : null }
                </Stack>
            </Collapse>
        </Box>
    );
}

export function AiSelfTest() {
    const [running, setRunning] = React.useState(false);
    const [result, setResult] = React.useState<AiBenchmarkResult | null>(null);
    const [error, setError] = React.useState<null | string>(null);

    // The run lives on the server, so closing the dialog only stops *watching*
    // it. Mounting re-attaches: whatever the server holds (running, done or
    // failed) is shown, and polling resumes if it is still going.
    const abortRef = React.useRef<AbortController | null>(null);

    // Shows a job's state and, while it runs, polls until it settles.
    const watch = React.useCallback(async (first: AiBenchmarkJob, signal: AbortSignal) => {
        let job = first;
        for (;;) {
            if (signal.aborted) return;
            setRunning(job.status === AiBenchmarkJobStatus.Running);
            if (job.status === AiBenchmarkJobStatus.Done) setResult(job.result ?? null);
            if (job.status === AiBenchmarkJobStatus.Failed) setError(job.error ?? "הבדיקה נכשלה");
            if (job.status !== AiBenchmarkJobStatus.Running) return;

            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            if (signal.aborted) return;
            // A dropped poll is not a failed run; keep the last state and retry.
            job = await fetchAiBenchmarkJob(signal).catch(() => job);
        }
    }, []);

    React.useEffect(() => {
        const abort = new AbortController();
        abortRef.current = abort;
        fetchAiBenchmarkJob(abort.signal)
            .then((job) => watch(job, abort.signal))
            .catch(() => undefined);
        return () => abort.abort();
    }, [watch]);

    const start = () => {
        const abort = abortRef.current;
        if (running || !abort) return;
        setRunning(true);
        setError(null);
        setResult(null);

        startAiBenchmark(abort.signal)
            .then((job) => watch(job, abort.signal))
            .catch((e: unknown) => {
                if (abort.signal.aborted) return;
                setRunning(false);
                setError(e instanceof Error ? e.message : String(e));
            });
    };

    return (
        <Stack spacing={ 1.5 } sx={ { width: "100%" } }>
            <Stack alignItems="center" direction="row" spacing={ 1 }>
                <Box flex={ 1 }>
                    <Typography sx={ { fontWeight: 700, fontSize: "0.9rem" } }>
                        בדיקת הסוכן
                    </Typography>
                    <Typography sx={ { fontSize: "0.72rem", color: "text.secondary" } }>
                        מריץ סדרת בדיקות על נתוני דמה כדי לוודא שהמודל המוגדר יודע
                        להשתמש בכלים ולא מבצע שינויים ללא אישור. לא נוגע בנתונים אמיתיים.
                    </Typography>
                </Box>
                <Button
                    disabled={ running }
                    onClick={ start }
                    size="small"
                    startIcon={ running
                        ? <CircularProgress size={ 14 } />
                        : <ScienceIcon fontSize="small" /> }
                    variant="outlined"
                >
                    { running ? "בודק…" : "בדוק את הסוכן שלי" }
                </Button>
            </Stack>

            { running
                ? <>
                    <LinearProgress sx={ { borderRadius: 1, height: 4 } } />
                    <Typography color="text.secondary" variant="caption">
                        הבדיקה מריצה כמה שיחות מלאות מול המודל — זה יכול לקחת דקה או שתיים.
                        אפשר לסגור את החלון; הבדיקה ממשיכה ברקע.
                    </Typography>
                </>
                : null }

            { error ? <Alert severity="error">{ error }</Alert> : null }

            { result
                ? <Stack spacing={ 1 }>
                    <Stack alignItems="center" direction="row" spacing={ 1 }>
                        <Chip
                            color={ result.passed === result.total ? "success" : "warning" }
                            label={ `${result.passed}/${result.total} בדיקות עברו` }
                            size="small"
                        />
                        <Typography color="text.secondary" variant="caption">
                            { result.model }
                            { result.totalTokens ? ` · ${result.totalTokens} טוקנים` : "" }
                            { ` · ${Math.round(result.durationMs / 1000)} שנ׳` }
                        </Typography>
                    </Stack>
                    { result.cases.map((entry) => (
                        <CaseRow entry={ entry } key={ entry.id } />
                    )) }
                </Stack>
                : null }
        </Stack>
    );
}
