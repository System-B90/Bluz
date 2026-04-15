/**
 * Name: CurriculumViewBuilderTab.tsx
 * Purpose: Renders curriculum weeks partitioned into N balanced groups with calculated working times.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ModuleId } from "@/api-shared/types/gant/curriculum";
import { CurriculumMappingProvider, useCurriculumMappings } from "@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import SyllabusModulesCurriculumViewSidebar from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules";
import { ModuleItem } from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules/ModuleItem";
import { partitionWeeks } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import WeekGroupPanel from "@/components/gant/curriculum-view/tabs/builder-tab/components/WeekGroupPanel";
import { useCurriculum } from "@/components/gant/state/hooks";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, closestCenter, defaultDropAnimationSideEffects, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Box, BoxProps, Divider } from "@mui/material";
import { useSnackbar } from "notistack";
import React, { useCallback, useMemo, useState } from "react";

export interface CurriculumViewBuilderTabProps extends Omit<BoxProps, 'className'>
{
    curriculumId: string;
    groupCount?: number;
}

function CurriculumViewBuilderTabInner({
    curriculumId,
    groupCount = 3,
}: Pick<CurriculumViewBuilderTabProps, 'curriculumId' | 'groupCount'>)
{
    const { enqueueSnackbar } = useSnackbar();
    const { moveModule, createMapping } = useCurriculumMappings();
    const weeks = useCurriculum(curriculumId)?.weeks;
    const groupedWeeks = useMemo(() => partitionWeeks(weeks ?? [], groupCount), [ weeks, groupCount ]);
    const [ activeId, setActiveId ] = useState<ModuleId | null>(null);
    const [ activeWeekIndex, setActiveWeekIndex ] = useState<number>();
    const [ activeDayIndex, setActiveDayIndex ] = useState<number>();

    function handleDragStart(event: DragStartEvent)
    {
        // Extract the ID from 'module-{moduleId}'
        const id = event.active.id.toString().replace("module-", "") as ModuleId;
        setActiveId(id);
        setActiveWeekIndex((event.active.data as any).weekIndex ?? undefined);
        setActiveDayIndex((event.active.data as any).dayIndex ?? undefined);
    }

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
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
        })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) =>
    {
        setActiveId(null);
        setActiveWeekIndex(undefined);
        setActiveDayIndex(undefined);

        const { active, over } = event;
        if (!over) return;

        const moduleId = (active.data.current as any).moduleId;
        const originWeekIndex = (active.data.current as any).weekIndex;
        const originDayIndex = (active.data.current as any).dayIndex;

        const weekIndex = (over.data.current as any).weekIndex;
        const dayIndex = (over.data.current as any).dayIndex;

        if (typeof originWeekIndex === 'number' && typeof originDayIndex === 'number')
        {
            moveModule(moduleId, { w: originWeekIndex, d: originDayIndex }, { w: weekIndex, d: dayIndex })
                .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'הזזת המערך נכשלה!', error));
        }
        else
        {
            createMapping(moduleId, weekIndex, dayIndex)
                .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'הזזת המערך נכשלה!', error));
        }
    }, [ createMapping, moveModule, enqueueSnackbar ]);

    return (
        <DndContext
            sensors={ sensors }
            collisionDetection={ closestCenter }
            onDragStart={ handleDragStart }
            onDragEnd={ handleDragEnd }
        >
            <SyllabusModulesCurriculumViewSidebar curriculumId={ curriculumId } />
            { groupedWeeks.map((group, index) =>
            {
                const isLast = index === groupedWeeks.length - 1;
                const groupKey = `group-${group[ 0 ]?.number ?? index}`;

                return (
                    <React.Fragment key={ groupKey }>
                        <WeekGroupPanel group={ group } allWeeks={ weeks ?? [] } />
                        { !isLast && (
                            <Divider
                                variant="middle"
                                orientation="vertical"
                                className="h-4/5 self-center"
                            />
                        ) }
                    </React.Fragment>
                );
            }) }

            <DragOverlay dropAnimation={ dropAnimation }>
                { activeId ? (
                    <ModuleItem
                        moduleId={ activeId }
                        className="w-70 shadow-2xl rotate-3 cursor-grabbing"
                        weekIndex={ activeWeekIndex }
                        dayIndex={ activeDayIndex }
                    />
                ) : null }
            </DragOverlay>
        </DndContext>
    );
}
export default function CurriculumViewBuilderTab({
    curriculumId,
    groupCount = 3,
    ...props
}: CurriculumViewBuilderTabProps)
{

    return (
        <Box
            { ...props }
            className="flex flex-row grow h-full gap-2"
        >
            <CurriculumMappingProvider curriculumId={ curriculumId }>
                <CurriculumViewBuilderTabInner curriculumId={ curriculumId } groupCount={ groupCount } />
            </CurriculumMappingProvider>
        </Box>
    );
}
