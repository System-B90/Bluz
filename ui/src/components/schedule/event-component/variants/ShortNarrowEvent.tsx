import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

import { ContainerSize } from "@/components/schedule/event-component/base";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import RoomComponent from "@/components/schedule/event-component/parts/room";
import { EventDurationLabel } from "@/components/schedule/event-component/utils";
import { Event } from "@/components/schedule/types/event";

export default function ShortNarrowEventComponent({ event: event, containerSize }: { containerSize: ContainerSize; } & EventProps<Event>)
{
    return (
        <Box
            display={ 'flex' }
            justifyContent={ 'space-around' }
            flexDirection={ 'column' }
        >
            <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' } justifyContent={ 'space-between' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                {/* <EventTypeIcon event={ event } /> */ }
                <Typography
                    variant="subtitle2"
                    noWrap
                    sx={ { ml: 0.5, fontWeight: 'bold' } }
                >
                    { event.name }
                </Typography>
                <EventDurationLabel event={ event } size="smaller" />
            </Box>

            <Box
                marginTop={ 0 }
                paddingTop={ 0 }
                sx={ { marginTop: '0 !important' } }
                flexGrow={ 1 }
                display={ 'flex' }
                flexDirection={ 'column' }
                flexWrap={ 'wrap' }
                justifyContent={ 'flex-start' }
                gap={ 0.5 }
            >
                <InstructorsList event={ event } chipSize="smaller" showCaption={ false } paddingBottom={ 0.5 } borderBottom={ 2 } />
                <RoomComponent roomIds={ event.rooms } showCaption={ false } chipSize="smaller" paddingBottom={ 0.5 } borderBottom={ 2 } />
            </Box>
        </Box>
    );
}
