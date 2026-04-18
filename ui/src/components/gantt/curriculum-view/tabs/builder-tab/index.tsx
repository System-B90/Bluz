/**
 * Name: CurriculumViewBuilderTab.tsx
 * Purpose: Renders curriculum weeks partitioned into N balanced groups with calculated working times.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Box, BoxProps } from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
  GanttDayId,
  GanttModuleId,
} from "@/api-shared/types/gantt/models/curriculum";
import {
  CurriculumMappingProvider,
  useCurriculumMappings,
} from "@/components/gantt/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import { CurriculumViewBuilderWeeksView } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/CurriculumViewBuilderWeeksView";
import { ModuleItem } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/syllabus-modules/ModuleItem";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";

export interface CurriculumViewBuilderTabProps extends Omit<
  BoxProps,
  "className"
> {
  curriculumId: string;
  groupCount?: number;
}

function CurriculumViewBuilderTabInner({
  curriculumId,
  groupCount = 3,
}: Pick<CurriculumViewBuilderTabProps, "curriculumId" | "groupCount">) {
  const { enqueueSnackbar } = useSnackbar();
  const { moveModule, createMapping, removeModule } = useCurriculumMappings();
  const weeks = useCurriculum(curriculumId)?.weeks;
  const [activeId, setActiveId] = useState<GanttModuleId>();
  const [activeDayId, setActiveDayId] = useState<GanttDayId>();

  function handleDragStart(event: DragStartEvent) {
    // Extract the ID from 'module-{moduleId}'
    const id = event.active.id
      .toString()
      .replace("module-", "") as GanttModuleId;
    setActiveId(id);
    setActiveDayId((event.active.data as any).dayId ?? undefined);
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires 5px of movement to start dragging (prevents accidental drags on clicks)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(undefined);
      setActiveDayId(undefined);

      const { active, over } = event;
      if (!over) return;

      const moduleId = (active.data.current as any).moduleId;
      const originDayId = (active.data.current as any).dayId;

      if ((over.data.current as any).type === "SIDEBAR") {
        removeModule(moduleId, originDayId).catch((error) =>
          enqueueApiErrorSnackbar(enqueueSnackbar, "הסרת המערך נכשלה!", error),
        );
        return;
      }

      const dayId = (over.data.current as any).dayId;

      if (typeof originDayId === "string") {
        moveModule(moduleId, { d: originDayId }, { d: dayId }).catch((error) =>
          enqueueApiErrorSnackbar(enqueueSnackbar, "הזזת המערך נכשלה!", error),
        );
      } else {
        createMapping(moduleId, dayId).catch((error) =>
          enqueueApiErrorSnackbar(enqueueSnackbar, "הזזת המערך נכשלה!", error),
        );
      }
    },
    [createMapping, moveModule, removeModule, enqueueSnackbar],
  );

  const [selectedWeekGroupIndicies, setSelectedWeekGroup] = useState<{
    start: number;
    length: number;
  }>({ start: 0, length: weeks?.length ?? 0 });
  const selectedWeekGroup = useMemo(
    () =>
      weeks?.slice(
        selectedWeekGroupIndicies.start,
        selectedWeekGroupIndicies.start + selectedWeekGroupIndicies.length,
      ),
    [selectedWeekGroupIndicies, weeks],
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <CurriculumViewBuilderWeeksView
        curriculumId={curriculumId}
        groupCount={groupCount}
        setSelectedWeekGroup={setSelectedWeekGroup}
        weeks={selectedWeekGroup ?? []}
      />

      <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? (
          <ModuleItem
            className="w-70 shadow-2xl rotate-3 cursor-grabbing"
            dayId={activeDayId}
            moduleId={activeId}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function CurriculumViewBuilderTab({
  curriculumId,
  groupCount = 3,
  ...props
}: CurriculumViewBuilderTabProps) {
  return (
    <Box {...props} className="flex flex-row grow h-full gap-2">
      <CurriculumMappingProvider curriculumId={curriculumId}>
        <CurriculumViewBuilderTabInner
          curriculumId={curriculumId}
          groupCount={groupCount}
        />
      </CurriculumMappingProvider>
    </Box>
  );
}
