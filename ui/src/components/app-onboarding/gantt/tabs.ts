/**
 * The gantt view tabs, by index, as `CurriculumViewTabs` renders them.
 *
 * The tour drives the tabs itself — a step about the week capacity is useless
 * while the syllabuses tab is showing — so it needs the same indices the tab
 * strip uses.
 */
export const GANTT_TAB_INDEX = {
    syllabuses: 0,
    weeks: 1,
    timeline: 2,
    cutPreview: 3,
    timeframeEvents: 4,
} as const;

/**
 * Tab content mounts a couple of frames after the tab changes (the tab strip
 * defers the first mount so the switch animates), so a tour step that points
 * into a freshly-opened tab has to let those frames pass before its anchor can
 * possibly exist.
 */
export async function waitForTabPaint(): Promise<void> {
    if (typeof window === "undefined") return;

    await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
        });
    });
}
