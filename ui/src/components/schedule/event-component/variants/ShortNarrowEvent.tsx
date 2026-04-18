import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

import { ContainerSize } from "@/components/schedule/event-component/base";
import { EventDurationLabel } from "@/components/schedule/event-component/EventDurationLabel";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import { RoomComponent } from "@/components/schedule/event-component/parts/room";
import { Event } from "@/components/schedule/types/event";

export function ShortNarrowEventComponent({ event: event, containerSize: _containerSize }: { containerSize: ContainerSize; } & EventProps<Event>)
{
    return (
        <Box
            display={ 'flex' }
            flexDirection={ 'column' }
            justifyContent={ 'space-around' }
        >
            <Box alignItems={ 'center' } display={ 'flex' } flexDirection={ 'row' } justifyContent={ 'space-between' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                {/* <EventTypeIcon event={ event } /> */ }
                <Typography
                    noWrap
                    sx={ { ml: 0.5, fontWeight: 'bold' } }
                    variant="subtitle2"
                >
                    { event.name }
                </Typography>
                <EventDurationLabel event={ event } size="smaller" />
            </Box>

            <Box
                display={ 'flex' }
                flexDirection={ 'column' }
                flexGrow={ 1 }
                flexWrap={ 'wrap' }
                gap={ 0.5 }
                justifyContent={ 'flex-start' }
                marginTop={ 0 }
                paddingTop={ 0 }
                sx={ { marginTop: '0 !important' } }
            >
                <InstructorsList borderBottom={ 2 } chipSize="smaller" event={ event } paddingBottom={ 0.5 } showCaption={ false } />
                <RoomComponent borderBottom={ 2 } chipSize="smaller" paddingBottom={ 0.5 } roomIds={ event.rooms } showCaption={ false } />
            </Box>
        </Box>
    );
}
