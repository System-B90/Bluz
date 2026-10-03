import { createViewerFlag } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-preferences";

/** Whether the insights card rotates by itself. Off by default (#851). */
export const insightsAutoRotate = createViewerFlag("bluz.insights.autoRotate", false);

/** Whether trivia ("fun") cards join the deck. Off by default on a work screen (#851). */
export const insightsShowFun = createViewerFlag("bluz.insights.showFun", false);
