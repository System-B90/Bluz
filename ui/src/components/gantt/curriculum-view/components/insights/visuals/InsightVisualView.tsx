import { InsightVisual } from "@/components/gantt/curriculum-view/components/insights/types";
import {
    InsightBars,
    InsightDonut,
    InsightRing,
    InsightTimeline,
    InsightWeekdayHeatmap,
} from "@/components/gantt/curriculum-view/components/insights/visuals/charts";
import {
    InsightBigNumber,
    InsightChips,
    InsightLeaderboard,
} from "@/components/gantt/curriculum-view/components/insights/visuals/lists";

export function InsightVisualView({ visual }: { visual: InsightVisual }) {
    switch (visual.kind) {
    case "bars": return <InsightBars { ...visual } />;
    case "bigNumber": return <InsightBigNumber { ...visual } />;
    case "chips": return <InsightChips { ...visual } />;
    case "donut": return <InsightDonut { ...visual } />;
    case "leaderboard": return <InsightLeaderboard { ...visual } />;
    case "ring": return <InsightRing { ...visual } />;
    case "timeline": return <InsightTimeline { ...visual } />;
    case "weekdayHeatmap": return <InsightWeekdayHeatmap { ...visual } />;
    }
}
