/**
 * The assistant's tool registry — the complete list of things the model is
 * allowed to do, and the only place that list is defined.
 */

import { AiToolSpec } from "@/api-server/ai/provider";
import { CALENDAR_TOOLS } from "@/api-server/ai/tools/calendar";
import { GANTT_TOOLS } from "@/api-server/ai/tools/gantt";
import { AiTool } from "@/api-server/ai/tools/types";
import { AiToolKind, AiToolSummary } from "@/api-shared/types/ai";

export type * from "@/api-server/ai/tools/types";

const ALL_TOOLS: Array<AiTool<any>> = [...CALENDAR_TOOLS, ...GANTT_TOOLS];

const BY_NAME = new Map(ALL_TOOLS.map((tool) => [tool.name, tool]));

/** @returns The tool with that name, or undefined if the model invented one. */
export function findTool(name: string): AiTool<any> | undefined {
    return BY_NAME.get(name);
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
        description: tool.description,
        kind: tool.kind,
    }));
}

/** Whether a tool changes stored data, and therefore needs approval. */
export function isWriteTool(tool: AiTool<any>): boolean {
    return tool.kind === AiToolKind.Write;
}
