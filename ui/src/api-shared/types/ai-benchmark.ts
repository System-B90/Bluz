/**
 * Contract for the assistant's self-test (#704).
 *
 * The question it answers is not "is the AI up" — the model chip already says
 * that — but "is the model behind this deployment actually *good enough* to be
 * trusted with the schedule". A gateway that silently downgrades to a weak
 * model still answers; it just stops calling tools correctly, which nothing
 * notices until someone acts on a wrong answer.
 *
 * So the verdict is deliberately per-check and not a single universal grade:
 * what counts as good enough is deployment-specific, and a badge claiming
 * "GOOD" would be a promise this cannot keep.
 */

/** One assertion about how the model behaved on a scripted prompt. */
export type AiBenchmarkCheck = {
    /** Hebrew, one line: what was expected. */
    label: string;
    passed: boolean;
    /** Why it failed, when it did. */
    detail?: string;
};

export type AiBenchmarkCase = {
    id: string;
    /** Hebrew title of what this case probes. */
    title: string;
    /** The prompt the model was given. */
    prompt: string;
    checks: Array<AiBenchmarkCheck>;
    /** Tool names the model called, in order, for the transcript view. */
    toolCalls: Array<string>;
    /** The model's final prose answer. */
    answer: string;
    /** Wall-clock time for the case. */
    durationMs: number;
    /** Set when the case could not run at all (upstream failure). */
    error?: string;
};

export type AiBenchmarkResult = {
    model: string;
    cases: Array<AiBenchmarkCase>;
    passed: number;
    total: number;
    /** Total tokens the run spent, so the cost of testing is visible. */
    totalTokens?: number;
    durationMs: number;
};

/**
 * One run per user per this window. A run drives several full agent turns
 * against a billed model, so it is throttled far harder than chat.
 */
export const AI_BENCHMARK_WINDOW_MS = 60 * 60 * 1_000;
