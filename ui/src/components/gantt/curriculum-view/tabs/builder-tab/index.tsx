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
import Box, { BoxProps } from "@mui/material/Box";

import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { GanttDayId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { CurriculumViewBuilderWeeksView } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/CurriculumViewBuilderWeeksView";
import {
    DndDragEventActiveData,
    DndDragEventOverData,
} from "@/components/gantt/curriculum-view/tabs/builder-tab/components/dnd-types";
import { ModuleItem } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/syllabus-modules/ModuleItem";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { GanttMappingProvider } from "@/components/gantt/state/mappings/Provider";

export type CurriculumViewBuilderTabProps = {
    curriculumId: string;
    groupCount?: number;
} & Omit<BoxProps, "className">;

function CurriculumViewBuilderTabInner({
    curriculumId,
    groupCount = 3,
}: Pick<CurriculumViewBuilderTabProps, "curriculumId" | "groupCount">) {
    const { enqueueSnackbar } = useSnackbar();
    const { moveMapping, createMapping, removeMapping } = useGanttMappings();
    const weeks = useCurriculum(curriculumId)?.weeks;
    const [activeId, setActiveId] = useState<GanttModuleId>();
    const [activeDayId, setActiveDayId] = useState<GanttDayId>();

    function handleDragStart(event: DragStartEvent) {
        // Extract the ID from 'module-{moduleId}'
        const activeData = event.active.data.current as DndDragEventActiveData;
        setActiveId(activeData.moduleId);
        setActiveDayId(activeData.dayId ?? undefined);
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

            const activeData = active.data.current as DndDragEventActiveData;
            const overData = over.data.current as DndDragEventOverData;

            if (activeData.type !== "MODULE") {
                // TODO: Implement
                return;
            }

            console.log("HERE!", activeData, overData);

            const moduleId = activeData.moduleId;
            const originDayId = activeData.dayId;

            if (overData.type === "SIDEBAR" && originDayId) {
                removeMapping({
                    moduleId,
                    eventId: null,
                    dayId: originDayId,
                }).catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "הסרת המערך נכשלה!",
                        error,
                    ),
                );
                return;
            }

            const targetDayId =
                overData.type === "DAY"
                    ? overData.dayId
                    : overData.type === "WEEK"
                        ? overData.firstDayId
                        : null;
            if (!targetDayId) {
                return;
            } // Should not happen

            if (originDayId && targetDayId) {
                moveMapping({
                    moduleId,
                    eventId: null,
                    from: { d: originDayId },
                    to: { d: targetDayId },
                }).catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "הזזת המערך נכשלה!",
                        error,
                    ),
                );
            } else {
                createMapping({
                    moduleId,
                    eventId: null,
                    dayId: targetDayId,
                }).catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "הזזת המערך נכשלה!",
                        error,
                    ),
                );
            }
        },
        [createMapping, moveMapping, removeMapping, enqueueSnackbar],
    );

    const [selectedWeekGroupIndicies, setSelectedWeekGroup] = useState<{
        start: number;
        length: number;
    }>({ start: 0, length: weeks?.length ?? 0 });
    const selectedWeekGroup = useMemo(
        () =>
            weeks?.slice(
                selectedWeekGroupIndicies.start,
                selectedWeekGroupIndicies.start +
                    selectedWeekGroupIndicies.length,
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
            <GanttMappingProvider curriculumId={curriculumId}>
                <CurriculumViewBuilderTabInner
                    curriculumId={curriculumId}
                    groupCount={groupCount}
                />
            </GanttMappingProvider>
        </Box>
    );
}
