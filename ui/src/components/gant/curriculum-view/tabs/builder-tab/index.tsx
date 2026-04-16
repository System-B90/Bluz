/**
 * Name: CurriculumViewBuilderTab.tsx
 * Purpose: Renders curriculum weeks partitioned into N balanced groups with calculated working times.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor, closestCenter, defaultDropAnimationSideEffects, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Box, BoxProps } from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ModuleId } from "@/api-shared/types/gant/curriculum";
import { CurriculumMappingProvider, useCurriculumMappings } from "@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import { CurriculumViewBuilderWeeksView } from "@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumViewBuilderWeeksView";
import { ModuleItem } from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules/ModuleItem";
import { useCurriculum } from "@/components/gant/state/hooks";

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
    const { moveModule, createMapping, removeModule } = useCurriculumMappings();
    const weeks = useCurriculum(curriculumId)?.weeks;
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

        if ((over.data.current as any).type === 'SIDEBAR')
        {
            removeModule(moduleId, originWeekIndex, originDayIndex)
                .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'הסרת המערך נכשלה!', error));
            return;
        }

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
    }, [ createMapping, moveModule, removeModule, enqueueSnackbar ]);

    const [ selectedWeekGroupIndicies, setSelectedWeekGroup ] = useState<{ start: number; length: number; }>({ start: 0, length: (weeks?.length ?? 0) });
    const selectedWeekGroup = useMemo(() => weeks?.slice(selectedWeekGroupIndicies.start, selectedWeekGroupIndicies.start + selectedWeekGroupIndicies.length), [ selectedWeekGroupIndicies, weeks ]);

    return (
        <DndContext
            sensors={ sensors }
            collisionDetection={ closestCenter }
            onDragStart={ handleDragStart }
            onDragEnd={ handleDragEnd }
        >
            <CurriculumViewBuilderWeeksView curriculumId={ curriculumId } weeks={ selectedWeekGroup ?? [] } groupCount={ groupCount } weekIndexStartOffset={ 0 } setSelectedWeekGroup={ setSelectedWeekGroup } />

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
