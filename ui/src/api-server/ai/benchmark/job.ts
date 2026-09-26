/**
 * Background self-test runs (#704).
 *
 * A run is minutes long — longer than a reverse proxy will hold one request
 * open (the 504 users saw) and longer than a settings dialog stays open. So the
 * route only *starts* a run and answers at once; the run lives here, keyed by
 * user, and is polled for its state.
 *
 * In-memory on purpose: a report is disposable, and a restart mid-run just
 * means the user runs it again (the throttle is what limits cost, not this).
 */

import { runAiBenchmark } from "@/api-server/ai/benchmark/run";
import { AiProvider } from "@/api-server/ai/provider";
import {
    AiBenchmarkJob,
    AiBenchmarkJobStatus,
} from "@/api-shared/types/ai-benchmark";
import { logger } from "@/logging/pino";

const JOBS_KEY = Symbol.for("bluz.ai.benchmark.jobs");
type GlobalWithJobs = typeof globalThis & {
    [JOBS_KEY]?: Map<string, AiBenchmarkJob>;
};

// Survives Next dev HMR / per-route module instances.
function jobs(): Map<string, AiBenchmarkJob> {
    const g = globalThis as GlobalWithJobs;
    return (g[JOBS_KEY] ??= new Map());
}

/** The user's latest run, or an idle marker when there has been none. */
export function getBenchmarkJob(userId: string): AiBenchmarkJob {
    return jobs().get(userId) ?? { status: AiBenchmarkJobStatus.Idle };
}

/**
 * Starts a run unless one is already going. Returns the job either way, so a
 * second click (or a second tab) just attaches to the run in flight.
 */
export function startBenchmarkJob(options: {
    provider: AiProvider;
    actor: { id: string; displayName: string };
}): { job: AiBenchmarkJob; started: boolean } {
    const current = getBenchmarkJob(options.actor.id);
    if (current.status === AiBenchmarkJobStatus.Running) {
        return { job: current, started: false };
    }

    const job: AiBenchmarkJob = {
        status: AiBenchmarkJobStatus.Running,
        startedAt: Date.now(),
    };
    jobs().set(options.actor.id, job);

    // Deliberately not awaited, and given no request signal: the run must
    // outlive the request that started it.
    void runAiBenchmark({
        ...options,
        onProgress: (cases) => {
            jobs().set(options.actor.id, { ...job, cases });
        },
    })
        .then((result) => {
            jobs().set(options.actor.id, {
                status: AiBenchmarkJobStatus.Done,
                startedAt: job.startedAt,
                result,
            });
        })
        .catch((e: unknown) => {
            const message = e instanceof Error ? e.message : String(e);
            logger.warn({ err: message }, "ai: benchmark run failed");
            jobs().set(options.actor.id, {
                status: AiBenchmarkJobStatus.Failed,
                startedAt: job.startedAt,
                error: message,
            });
        });

    return { job, started: true };
}
