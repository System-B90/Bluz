'use client';

import CourseField from '@/components/schedule/event-dialog/CourseField';
import EventTypeField from "@/components/schedule/event-dialog/EventTypeField";
import ModuleField from '@/components/schedule/event-dialog/ModuleField';
import PrayerTypeField from '@/components/schedule/event-dialog/PrayerType';
import RoomField from "@/components/schedule/event-dialog/RoomField";
import SubjectField from "@/components/schedule/event-dialog/SubjectField";
import { Event, PrayerEvent } from "@/components/schedule/types/event";
import { Box } from '@mui/material';

export function EventClassification({ event, onUpdate }: {
    event: Event,
    onUpdate: (u: Partial<Event>) => void;
})
{
    return (
        <Box display="flex" width="100%" gap={ 2 } justifyContent="flex-start">
            <EventTypeField
                event={ event }
                onBlurCallback={ onUpdate }
                sx={ { width: '12.5%' } }
            />

            { event?.type === 'prayer' ? (
                <PrayerTypeField
                    event={ event as PrayerEvent }
                    onEventChange={ onUpdate }
                    sx={ { width: '25%' } }
                />
            ) : (
                <>
                    <SubjectField
                        event={ event }
                        onEventChange={ onUpdate }
                        sx={ { width: '18%' } }
                    />
                    <ModuleField
                        event={ event }
                        onEventChange={ onUpdate }
                        sx={ { width: '17%' } }
                    />
                </>
            ) }

            <Box gap="inherit" display="flex" flexGrow={ 1 }>
                <CourseField
                    event={ event }
                    onBlurCallback={ onUpdate }
                    fullWidth
                />
                <RoomField
                    event={ event }
                    onBlurCallback={ onUpdate }
                    fullWidth
                />
            </Box>
        </Box>
    );
}
