import { CONTENT_INSIGHTS } from "@/components/gantt/curriculum-view/components/insights/generators/content";
import { EXECUTION_INSIGHTS } from "@/components/gantt/curriculum-view/components/insights/generators/execution";
import { FUN_INSIGHTS } from "@/components/gantt/curriculum-view/components/insights/generators/fun";
import { PEOPLE_INSIGHTS } from "@/components/gantt/curriculum-view/components/insights/generators/people";
import { SCHEDULE_INSIGHTS } from "@/components/gantt/curriculum-view/components/insights/generators/schedule";
import { STRUCTURE_INSIGHTS } from "@/components/gantt/curriculum-view/components/insights/generators/structure";
import {
    Insight,
    InsightContext,
    InsightGenerator,
    InsightSeverity,
} from "@/components/gantt/curriculum-view/components/insights/types";

export const INSIGHT_GENERATORS: ReadonlyArray<InsightGenerator> = [
    ...SCHEDULE_INSIGHTS,
    ...CONTENT_INSIGHTS,
    ...EXECUTION_INSIGHTS,
    ...PEOPLE_INSIGHTS,
    ...STRUCTURE_INSIGHTS,
    ...FUN_INSIGHTS,
];

const FUN_EVERY = 4;

function isSeverity(severity: InsightSeverity) {
    return (insight: Insight) => insight.severity === severity;
}

/**
 * Runs every generator, then orders the deck: warnings first (they are the
 * point), then the rest with a fun card sprinkled in every few slots so the
 * humour never clumps. A throwing generator is dropped rather than taking the
 * whole card down.
 */
export function generateInsights(ctx: InsightContext): Array<Insight> {
    const insights = INSIGHT_GENERATORS.flatMap((generate) => {
        try {
            return generate(ctx) ?? [];
        } catch {
            return [];
        }
    });

    const warnings = insights.filter(isSeverity("warning"));
    const fun = insights.filter(isSeverity("fun"));
    const rest = insights.filter((i) => i.severity !== "warning" && i.severity !== "fun");

    const ordered: Array<Insight> = [ ...warnings ];
    rest.forEach((insight, i) => {
        ordered.push(insight);
        if ((i + 1) % FUN_EVERY === 0 && fun.length > 0) ordered.push(fun.shift() as Insight);
    });
    return [ ...ordered, ...fun ];
}
