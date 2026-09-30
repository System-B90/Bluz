import Typography from "@mui/material/Typography";
import React from "react";

import { formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";

/** Required-hours column pinned to the end of a label cell (#766). */
export const GanttHoursLabel: React.FC<{ minutes: number }> = ({ minutes }) => (
    <Typography
        color="text.secondary"
        data-testid="gantt-hours-label"
        noWrap
        sx={ {
            flexShrink: 0,
            marginInlineStart: "auto",
            paddingInlineStart: 1,
            fontVariantNumeric: "tabular-nums",
        } }
        variant="caption"
    >
        { formatHoursLabel(minutes) }
    </Typography>
);
