import { CurriculumId } from '@/api-shared/types/gant/curriculum';
import CurriculumViewSidebar from '@/components/gant/curriculum-view/components/sidebars';
import CurriculumViewTabs from '@/components/gant/curriculum-view/tabs';
import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Box, BoxProps } from '@mui/material';
import { useState } from 'react';

export interface CurriculumViewProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

export default function CurriculumView({ curriculumId, ...props }: CurriculumViewProps)
{
    const [ selectedTabIndex, setSelectedTabIndex ] = useState<number>(0);

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
        const { active, over } = event;
        if (!over) return;

        // Logic to update state goes here
        console.log(`Module ${active.id} dropped on ${over.id}`);
    }


    return (
        <Box
            gap={ 4 }
            display={ 'flex' }
            flexDirection={ 'row' }
            flexWrap={ 'nowrap' }
            width={ '100%' }
            height={ '100%' }
            alignItems={ 'flex-start' }
            justifyItems={ 'flex-start' }
            justifyContent={ 'flex-start' }
            { ...props }
        >
            <DndContext
                sensors={ sensors }
                collisionDetection={ closestCenter }
                onDragEnd={ handleDragEnd }
            >
                <CurriculumViewSidebar selectedTabIndex={ selectedTabIndex } curriculumId={ curriculumId } />

                <CurriculumViewTabs
                    curriculumId={ curriculumId }
                    selectedTabIndex={ selectedTabIndex }
                    setSelectedTabIndex={ setSelectedTabIndex }
                    flexGrow={ 1 }
                    height={ '100%' }
                    width={ '100%' }
                    display={ 'flex' }
                    flexDirection={ 'column' }
                />
            </DndContext>
        </Box>
    );
}
