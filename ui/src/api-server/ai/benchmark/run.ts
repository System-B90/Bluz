/**
 * Runs the assistant self-test (#704).
 *
 * It drives `runAiAgent` — the same loop the chat FAB uses, with the same
 * approval gate — rather than a bare `chat()` call, because the failure mode
 * worth catching is not "the model writes bad prose". It is "the model stopped
 * calling tools correctly", which a prose-only probe passes happily.
 *
 * Nothing here can write: the fixture's write tools throw if executed, and no
 * tool call id is ever approved, so a proposal is where every write stops.
 */

import { runAiAgent } from "@/api-server/ai/agent";
import {
    AI_BENCHMARK_CASES,
    AiBenchmarkObservation,
    isWriteToolName,
} from "@/api-server/ai/benchmark/cases";
import {
    FIXTURE_CURRICULUM_ID,
    FIXTURE_NOW,
    FIXTURE_TOOLS,
} from "@/api-server/ai/benchmark/fixture";
import { AiProvider } from "@/api-server/ai/provider";
import {
    AiToolContext,
    AiToolRegistry,
    createToolRegistry,
} from "@/api-server/ai/tools";
import { AiRole, AiStreamEventType } from "@/api-shared/types/ai";
import {
    AiBenchmarkCase,
    AiBenchmarkResult,
} from "@/api-shared/types/ai-benchmark";
import { logger } from "@/logging/pino";

/**
 * The fixture registry, with every read recording the arguments it was called
 * with — rubrics such as "read Tuesday only" grade the call, not the prose.
 */
function instrumentedRegistry(
    reads: AiBenchmarkObservation["reads"],
): AiToolRegistry {
    return createToolRegistry(
        FIXTURE_TOOLS.map((tool) => ({
            ...tool,
            execute: async (args: Record<string, unknown>, context: AiToolContext) => {
                reads.push({ name: tool.name, args });
                return await tool.execute(args, context);
            },
        })),
    );
}

/**
 * The context handed to fixture tools.
 *
 * The controller factories throw rather than returning a stub: no fixture tool
 * asks for one, and if one ever did, failing loudly is the only acceptable
 * outcome — a self-test that quietly reaches the user's real database is worse
 * than no self-test.
 */
export function benchmarkContext(actor: {
    id: string;
    displayName: string;
}): AiToolContext {
    const refuse = () => {
        throw new Error("בדיקת הסוכן אינה ניגשת לנתונים אמיתיים");
    };
    return {
        curriculumId: FIXTURE_CURRICULUM_ID,
        now: FIXTURE_NOW,
        actor,
        readController: refuse,
        writeController: refuse,
    };
}

/** Runs one scripted prompt and records how the model behaved. */
async function runCase(
    spec: (typeof AI_BENCHMARK_CASES)[number],
    provider: AiProvider,
    context: AiToolContext,
    signal: AbortSignal | undefined,
): Promise<{ result: AiBenchmarkCase; tokens: number }> {
    const startedAt = Date.now();
    const observation: AiBenchmarkObservation = {
        toolCalls: [],
        proposedWrites: [],
        executedWrites: [],
        askedUser: false,
        answer: "",
        reads: [],
        proposals: [],
    };
    let tokens = 0;
    let error: string | undefined;

    try {
        const events = runAiAgent({
            provider,
            messages: [{ role: AiRole.User, content: spec.prompt }],
            context,
            // Never populated, by design: an approved id is the only thing
            // that can make a write run, and this run grants none.
            approvedToolCallIds: new Set<string>(),
            registry: instrumentedRegistry(observation.reads),
            signal,
        });

        for await (const event of events) {
            switch (event.type) {
            case AiStreamEventType.Delta:
                observation.answer += event.text;
                break;
            case AiStreamEventType.ToolStart:
                observation.toolCalls.push(event.name);
                if (isWriteToolName(event.name)) {
                    // Reached only if the gate failed; the checks grade it.
                    observation.executedWrites.push(event.name);
                }
                break;
            case AiStreamEventType.ToolProposal:
                observation.toolCalls.push(event.name);
                observation.proposedWrites.push(event.name);
                observation.proposals.push({
                    name: event.name,
                    args: (event.arguments ?? {}) as Record<string, unknown>,
                });
                break;
            case AiStreamEventType.Choice:
                observation.toolCalls.push("ask_user");
                observation.askedUser = true;
                break;
            case AiStreamEventType.Done:
                tokens += event.usage?.totalTokens ?? 0;
                break;
            case AiStreamEventType.Error:
                error = event.message;
                break;
            default:
                break;
            }
        }
    } catch (e) {
        // One case failing upstream must not abort the whole report: the
        // remaining cases still say something useful about the model.
        error = e instanceof Error ? e.message : String(e);
        logger.warn({ case: spec.id, err: error }, "ai: benchmark case failed");
    }

    return {
        tokens,
        result: {
            id: spec.id,
            title: spec.title,
            prompt: spec.prompt,
            toolCalls: observation.toolCalls,
            answer: observation.answer.trim(),
            durationMs: Date.now() - startedAt,
            ...(error ? { error } : {}),
            checks: spec.checks.map((check) => {
                // A case that never ran fails every check, and says why once —
                // grading its empty observation would report four misleading
                // behavioural failures for one connection problem.
                if (error) {
                    return {
                        label: check.label,
                        passed: false,
                        detail: "המקרה לא הושלם בגלל תקלה בשירות המודל.",
                    };
                }
                const passed = check.run(observation);
                return {
                    label: check.label,
                    passed,
                    ...(passed ? {} : { detail: check.detail }),
                };
            }),
        },
    };
}

/**
 * Runs the whole suite.
 *
 * Cases run in sequence, not in parallel: a self-hosted gateway with one
 * worker — the deployment this feature exists for — answers four concurrent
 * turns by timing three of them out, which would report a perfectly good model
 * as broken.
 */
export async function runAiBenchmark(options: {
    provider: AiProvider;
    actor: { id: string; displayName: string };
    signal?: AbortSignal;
}): Promise<AiBenchmarkResult> {
    const startedAt = Date.now();
    const context = benchmarkContext(options.actor);
    const cases: Array<AiBenchmarkCase> = [];
    let totalTokens = 0;

    for (const spec of AI_BENCHMARK_CASES) {
        const { result, tokens } = await runCase(
            spec,
            options.provider,
            context,
            options.signal,
        );
        cases.push(result);
        totalTokens += tokens;
    }

    const checks = cases.flatMap((entry) => entry.checks);
    return {
        model: options.provider.defaultModel,
        cases,
        passed: checks.filter((check) => check.passed).length,
        total: checks.length,
        ...(totalTokens ? { totalTokens } : {}),
        durationMs: Date.now() - startedAt,
    };
}
