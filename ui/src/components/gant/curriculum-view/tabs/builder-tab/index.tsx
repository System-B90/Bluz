/**
 * Name: CurriculumViewBuilderTab.tsx
 * Purpose: Renders curriculum weeks partitioned into N balanced groups with calculated working times.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { ModuleId } from "@/api-shared/types/gant/curriculum";
import SyllabusModulesCurriculumViewSidebar from "@/components/gant/curriculum-view/components/sidebars/syllabus-modules";
import { ModuleItem } from "@/components/gant/curriculum-view/components/sidebars/syllabus-modules/ModuleItem";
import { CurriculumMappingProvider } from "@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import { partitionWeeks } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import WeekGroupPanel from "@/components/gant/curriculum-view/tabs/builder-tab/components/WeekGroupPanel";
import { useCurriculum } from "@/components/gant/state/hooks";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, closestCenter, defaultDropAnimationSideEffects, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Box, BoxProps, Divider } from "@mui/material";
import React, { useMemo, useState } from "react";

export interface CurriculumViewBuilderTabProps extends Omit<BoxProps, 'className'>
{
    curriculumId: string;
    groupCount?: number;
}

export default function CurriculumViewBuilderTab({
    curriculumId,
    groupCount = 3,
    ...props
}: CurriculumViewBuilderTabProps)
{
    const weeks = useCurriculum(curriculumId)?.weeks;
    const groupedWeeks = useMemo(() => partitionWeeks(weeks ?? [], groupCount), [ weeks, groupCount ]);
    const [ activeId, setActiveId ] = useState<ModuleId | null>(null);

    function handleDragStart(event: DragStartEvent)
    {
        // Extract the ID from 'module-{moduleId}'
        const id = event.active.id.toString().replace("module-", "") as ModuleId;
        setActiveId(id);
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

    function handleDragEnd(event: DragEndEvent)
    {
        setActiveId(null);

        const { active, over } = event;
        if (!over) return;

        // Logic to update state goes here
        console.log(`Module ${active.id} dropped on ${over.id}`);
    }

    return (
        <Box
            { ...props }
            className="flex flex-row grow h-full gap-2"
        >
            <CurriculumMappingProvider curriculumId={ curriculumId }>
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
                            />
                        ) : null }
                    </DragOverlay>
                </DndContext>
            </CurriculumMappingProvider>
        </Box>
    );
}
