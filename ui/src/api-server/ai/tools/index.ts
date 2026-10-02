/**
 * The assistant's tool registry — the complete list of things the model is
 * allowed to do, and the only place that list is defined.
 */

import { AiToolSpec } from "@/api-server/ai/provider";
import { askUserTool } from "@/api-server/ai/tools/ask-user";
import { CALENDAR_TOOLS } from "@/api-server/ai/tools/calendar";
import { CALENDAR_ENTITY_TOOLS } from "@/api-server/ai/tools/calendar-entities";
import { GANTT_TOOLS } from "@/api-server/ai/tools/gantt";
import { GANTT_AUTHORING_TOOLS } from "@/api-server/ai/tools/gantt-authoring";
import { HIVE_TOOLS } from "@/api-server/ai/tools/hive";
import { AiTool } from "@/api-server/ai/tools/types";
import { AiToolDanger, AiToolKind, AiToolSummary } from "@/api-shared/types/ai";

export type * from "@/api-server/ai/tools/types";

const ALL_TOOLS: Array<AiTool<any>> = [
    askUserTool,
    ...CALENDAR_TOOLS,
    ...CALENDAR_ENTITY_TOOLS,
    ...GANTT_TOOLS,
    ...GANTT_AUTHORING_TOOLS,
    ...HIVE_TOOLS,
];

const BY_NAME = new Map(ALL_TOOLS.map((tool) => [tool.name, tool]));

/**
 * A set of tools the agent loop may call.
 *
 * The loop takes one of these rather than reaching for the module-level
 * registry, so the self-test benchmark can hand it fixture tools that answer
 * from fabricated data — the same code path, the same approval gate, none of
 * the user's real records.
 */
export type AiToolRegistry = {
    find: (name: string) => AiTool<any> | undefined;
    specs: () => Array<AiToolSpec>;
    /** Human-facing label for a name, including names not in this registry. */
    title: (name: string) => string;
};

/** Builds a registry over an explicit tool list. */
export function createToolRegistry(
    tools: Array<AiTool<any>>,
): AiToolRegistry {
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    return {
        find: (name) => byName.get(name),
        specs: () =>
            tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            })),
        title: (name) => byName.get(name)?.title ?? name,
    };
}

/** Every production tool, for the self-test to mirror. */
export function allTools(): Array<AiTool<any>> {
    return ALL_TOOLS;
}

/** The real registry: every tool the assistant has against live data. */
export const DEFAULT_TOOL_REGISTRY = createToolRegistry(ALL_TOOLS);

/** @returns The tool with that name, or undefined if the model invented one. */
export function findTool(name: string): AiTool<any> | undefined {
    return BY_NAME.get(name);
}

/**
 * The human-facing label for a tool name.
 *
 * Takes a name rather than a tool so that a call to something unregistered —
 * a model hallucinating `delete_everything` — still renders as text a person
 * can read instead of a blank chip.
 */
export function toolTitle(name: string): string {
    return BY_NAME.get(name)?.title ?? name;
}

/** How dangerous a named tool is; unknown names are treated as writes. */
export function toolDanger(name: string): AiToolDanger {
    return BY_NAME.get(name)?.danger ?? AiToolDanger.Caution;
}

/** The registry as advertised to the model. */
export function toolSpecs(): Array<AiToolSpec> {
    return ALL_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
    }));
}

/** The registry as advertised to the browser, for the "what can it do" panel. */
export function toolSummaries(): Array<AiToolSummary> {
    return ALL_TOOLS.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        kind: tool.kind,
        danger: tool.danger,
    }));
}

/** Whether a tool changes stored data, and therefore needs approval. */
export function isWriteTool(tool: AiTool<any>): boolean {
    return tool.kind === AiToolKind.Write;
}

/** Whether a tool is a question for the human rather than an operation. */
export function isPromptTool(tool: AiTool<any>): boolean {
    return tool.kind === AiToolKind.Prompt;
}
