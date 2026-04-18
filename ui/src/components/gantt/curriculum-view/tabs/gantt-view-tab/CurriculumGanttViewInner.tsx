/**
 * Name: CurriculumGanttViewInner.tsx
 * Purpose: Inner component that renders the Gantt chart with interaction handling.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

"use client";

import { Paper } from "@mui/material";
import { useSnackbar } from "notistack";
import React, { useCallback, useMemo } from "react";

import { useCurriculumMappings } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import { GanttEngine } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/GanttEngine";
import {
  GanttDataResult,
  GanttDataSourceProps,
  SvarGanttDataUpdateEvent,
  SvarGanttScale,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/types";
import { useGanttData } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/UseGanttData";

/**
 * Inner component that handles Gantt rendering with data transformation
 */
export function CurriculumGanttViewInner(
  props: GanttDataSourceProps,
): React.ReactElement {
  const { enqueueSnackbar } = useSnackbar();
  const { moveModule } = useCurriculumMappings();
  const { tasks, links }: GanttDataResult = useGanttData(props);

  const scales: Array<SvarGanttScale> = useMemo(
    (): Array<SvarGanttScale> => [
      {
        unit: "weeks",
        step: 1,
        format: "Week %W",
      },
    ],
    [],
  );

  const handleDataUpdate = useCallback(
    (_event: SvarGanttDataUpdateEvent): void => {
      // TODO: Implement
    },
    [],
  );

  return (
    <Paper sx={{ flexGrow: 1, overflow: "hidden" }} variant="outlined">
      <GanttEngine
        links={links}
        onDataUpdate={handleDataUpdate}
        scales={scales}
        tasks={tasks}
      />
    </Paper>
  );
}
