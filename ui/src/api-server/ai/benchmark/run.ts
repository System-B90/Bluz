/**
 * Runs the assistant self-test (#704).
 *
 * It drives `runAiAgent` — the same loop the chat FAB uses, with the same
 * approval gate — rather than a bare `chat()` call, because the failure mode
 * worth catching is not "the model writes bad prose". It is "the model stopped
 * calling tools correctly", which a prose-only probe passes happily.
 *
 * Nothing here can write: every write tool throws if executed, and no tool
 * call id is ever approved, so a proposal is where every write stops.
 */

import { runAiAgent } from "@/api-server/ai/agent";
import {
    AI_BENCHMARK_CASES,
    AiBenchmarkObservation,
} from "@/api-server/ai/benchmark/cases";
import {
    benchmarkTools,
    FIXTURE_CURRICULUM_ID,
    FIXTURE_NOW,
} from "@/api-server/ai/benchmark/fixture";
import { AiProvider } from "@/api-server/ai/provider";
import { buildSystemPrompt } from "@/api-server/ai/system-prompt";
import {
    AiToolContext,
    AiToolRegistry,
    allTools,
    createToolRegistry,
} from "@/api-server/ai/tools";
import { AiMessage, AiRole, AiStreamEventType, AiToolKind } from "@/api-shared/types/ai";
import {
    AiBenchmarkCase,
    AiBenchmarkCaseState,
    AiBenchmarkLiveCase,
    AiBenchmarkResult,
} from "@/api-shared/types/ai-benchmark";
import { logger } from "@/logging/pino";

/**
 * The full production tool surface over fixture answers, with every read
 * recording the arguments it was called with — rubrics such as "read Tuesday
 * only" grade the call, not the prose.
 */
function instrumentedRegistry(
    reads: AiBenchmarkObservation["reads"],
): AiToolRegistry {
    return createToolRegistry(
        benchmarkTools(allTools()).map((tool) => ({
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
    onToolCall: (name: string) => void,
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
    let transcript: Array<AiMessage> = [];
    let reasoning = "";
    const registry = instrumentedRegistry(observation.reads);
    const called = (name: string) => {
        observation.toolCalls.push(name);
        onToolCall(name);
    };

    try {
        const events = runAiAgent({
            provider,
            messages: [{ role: AiRole.User, content: spec.prompt }],
            context,
            // Never populated, by design: an approved id is the only thing
            // that can make a write run, and this run grants none.
            approvedToolCallIds: new Set<string>(),
            registry,
            signal,
        });

        for await (const event of events) {
            switch (event.type) {
            case AiStreamEventType.Delta:
                observation.answer += event.text;
                break;
            case AiStreamEventType.ReasoningDelta:
            case AiStreamEventType.Reasoning:
                reasoning += event.text;
                break;
            case AiStreamEventType.ToolStart:
                called(event.name);
                if (registry.find(event.name)?.kind === AiToolKind.Write) {
                    // Reached only if the gate failed; gateHeld reports it.
                    observation.executedWrites.push(event.name);
                }
                break;
            case AiStreamEventType.ToolProposal:
                called(event.name);
                observation.proposedWrites.push(event.name);
                observation.proposals.push({
                    name: event.name,
                    args: (event.arguments ?? {}) as Record<string, unknown>,
                });
                break;
            case AiStreamEventType.Choice:
                called("ask_user");
                observation.askedUser = true;
                break;
            case AiStreamEventType.Done:
                tokens += event.usage?.totalTokens ?? 0;
                transcript = event.messages;
                break;
            case AiStreamEventType.Error:
                error = event.message;
                transcript = event.messages ?? transcript;
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

    const checks = spec.checks.map((check) => {
        // A case that never ran fails every check, and says why once —
        // grading its empty observation would report misleading behavioural
        // failures for one connection problem.
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
    });

    return {
        tokens,
        result: {
            id: spec.id,
            title: spec.title,
            prompt: spec.prompt,
            toolCalls: observation.toolCalls,
            answer: observation.answer.trim(),
            transcript: [{ role: AiRole.User, content: spec.prompt }, ...transcript],
            proposals: observation.proposals,
            ...(reasoning ? { reasoning } : {}),
            durationMs: Date.now() - startedAt,
            ...(error ? { error } : {}),
            checks,
            passed: checks.every((check) => check.passed),
            gateHeld: observation.executedWrites.length === 0,
        },
    };
}

/**
 * Runs the whole suite.
 *
 * Cases run in sequence, not in parallel: a self-hosted gateway with one
 * worker — the deployment this feature exists for — answers concurrent turns
 * by timing most of them out, which would report a perfectly good model as
 * broken.
 *
 * `onProgress` gets a fresh snapshot after every state change, for the live
 * view.
 */
export async function runAiBenchmark(options: {
    provider: AiProvider;
    actor: { id: string; displayName: string };
    signal?: AbortSignal;
    onProgress?: (cases: Array<AiBenchmarkLiveCase>) => void;
}): Promise<AiBenchmarkResult> {
    const startedAt = Date.now();
    const context = benchmarkContext(options.actor);
    const live: Array<AiBenchmarkLiveCase> = AI_BENCHMARK_CASES.map((spec) => ({
        id: spec.id,
        title: spec.title,
        prompt: spec.prompt,
        state: AiBenchmarkCaseState.Pending,
        toolCalls: [],
    }));
    const publish = () => options.onProgress?.(live.map((entry) => ({ ...entry })));
    publish();

    const cases: Array<AiBenchmarkCase> = [];
    let totalTokens = 0;

    for (const [index, spec] of AI_BENCHMARK_CASES.entries()) {
        const entry = live[index];
        entry.state = AiBenchmarkCaseState.Running;
        publish();
        const { result, tokens } = await runCase(
            spec,
            options.provider,
            context,
            options.signal,
            (name) => {
                entry.toolCalls = [...entry.toolCalls, name];
                publish();
            },
        );
        entry.state = AiBenchmarkCaseState.Done;
        entry.result = result;
        publish();
        cases.push(result);
        totalTokens += tokens;
    }

    const checks = cases.flatMap((entry) => entry.checks);
    return {
        model: options.provider.defaultModel,
        systemPrompt: buildSystemPrompt(context),
        cases,
        passed: cases.filter((entry) => entry.passed).length,
        total: cases.length,
        checksPassed: checks.filter((check) => check.passed).length,
        checksTotal: checks.length,
        gateHeld: cases.every((entry) => entry.gateHeld),
        ...(totalTokens ? { totalTokens } : {}),
        durationMs: Date.now() - startedAt,
    };
}
