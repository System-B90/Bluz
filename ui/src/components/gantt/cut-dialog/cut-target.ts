import { Iteration } from "@/api-shared/types/iteration";

/**
 * What the cut dialog knows, before the user presses "גזירה", about where the
 * cut will land (#838). Resolved when the dialog opens so a missing iteration
 * link disables the button instead of failing after the click.
 */
export type CutTarget =
    | { status: "linked"; iterationLabel: string; plannedEvents: null | number }
    | { status: "loading" }
    | { status: "unknown" }
    | { status: "unlinked" };

export const CUT_NO_ITERATION_REASON = "יש לקשר מחזור לפני גזירה";

/** The iteration the cut endpoint will write into, if any. */
export function findLinkedIteration(
    iterations: ReadonlyArray<Iteration>,
    curriculumId: string,
): Iteration | undefined {
    return iterations.find((iteration) => iteration.ganttCurriculumId === curriculumId);
}

/** Only an unlinked curriculum is blocked up front; everything else is checked by the plan. */
export function isCutBlocked(target: CutTarget): boolean {
    return target.status === "unlinked" || target.status === "loading";
}

/** The one-line "what will happen" summary shown above the cut options. */
export function describeCutTarget(target: CutTarget): null | string {
    switch (target.status) {
    case "loading":
        return "בודק את המחזור המקושר…";
    case "unknown":
        return null;
    case "unlinked":
        return `${CUT_NO_ITERATION_REASON}. ניתן לקשר מחזור בשדה "מחזור מקושר" של תוכנית הלימודים.`;
    case "linked":
        return target.plannedEvents === null
            ? `האירועים ייווצרו במחזור "${target.iterationLabel}".`
            : `ייווצרו ${target.plannedEvents} אירועים במחזור "${target.iterationLabel}".`;
    }
}
