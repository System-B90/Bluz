import { createViewerFlag } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-preferences";

/**
 * The timeline (רצף זמן) toolbar's view choices, remembered per viewer so a
 * reload keeps them (#821).
 */
export const timelineWeeklyView = createViewerFlag("bluz.timeline.weeklyView", true);
export const timelineShowConstraints = createViewerFlag("bluz.timeline.showConstraints", true);
export const timelineShowUnallocated = createViewerFlag("bluz.timeline.showUnallocated", false);
export const timelineIgnoreBreaks = createViewerFlag("bluz.timeline.ignoreBreaks", false);
export const timelineRelativeDaySizing = createViewerFlag("bluz.timeline.relativeDaySizing", false);
