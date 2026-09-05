import { TourStep } from "@/components/onboarding/types";

export type StepDirection = -1 | 1;

/**
 * The next index in `direction` whose step can actually be shown, or `null`
 * when the tour runs off either end.
 *
 * Steps are skipped, not stalled on: a step marked `optional` whose anchor is
 * nowhere on screen is simply not part of this run — which is what lets one
 * tour describe UI that only some users, or some states, ever render.
 */
export function findShowableStep(
    steps: Array<TourStep>,
    from: number,
    direction: StepDirection,
    canShow: (step: TourStep) => boolean,
): null | number {
    for (
        let index = from + direction;
        index >= 0 && index < steps.length;
        index += direction
    ) {
        if (canShow(steps[index])) return index;
    }

    return null;
}

/** Human-facing position of `index` among the steps this run will show. */
export function stepProgress(
    steps: Array<TourStep>,
    index: number,
    canShow: (step: TourStep) => boolean,
): { current: number; total: number } {
    let current = 0;
    let total = 0;

    steps.forEach((step, stepIndex) => {
        if (stepIndex !== index && !canShow(step)) return;
        total += 1;
        if (stepIndex <= index) current += 1;
    });

    return { current: Math.max(1, current), total: Math.max(1, total) };
}
