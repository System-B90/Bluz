/**
 * Name: MetricItem.tsx
 * Purpose: Displays a metric label with its value.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { MetricItemProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/types";

export function MetricItem({ label, value }: MetricItemProps) {
    return (
        <Box>
            <Typography
                color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: 1 }}
                variant="caption"
            >
                {label}
            </Typography>
            <Typography variant="h5">{value}</Typography>
        </Box>
    );
}
