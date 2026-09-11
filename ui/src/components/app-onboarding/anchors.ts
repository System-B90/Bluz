/**
 * Every anchor id Bluz spotlights, in one place.
 *
 * Ids are the contract between a component (which registers one with
 * `useTourAnchor`) and a tour (which points at one). Naming them here rather
 * than inline keeps that contract greppable and typo-proof.
 */
export const APP_ANCHORS = {
    /** The "?" button in the app bar. */
    help: "app.help",
} as const;

export const GANTT_ANCHORS = {
    /** The floating gantt-picker button. */
    curriculumFab: "gantt.curriculum-fab",
    /** The five view tabs. */
    tabs: "gantt.tabs",
    /** The about/hours sidebar. */
    sidebar: "gantt.sidebar",
    /** The fuzzy search field over the loaded curriculum. */
    search: "gantt.search",
} as const;
