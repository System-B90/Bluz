import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

import { EventStatusIcons, EventDurationLabel, EventTypeIcon } from "@/components/schedule/event-component/utils";
import { PrayerEvent } from "@/components/schedule/types/event";

export default function PrayerEventComponent({ event: event }: EventProps<PrayerEvent>)
{
    return (
        <Box
            alignItems={ 'center' }
            display={ 'flex' }
            height={ '100%' }
            justifyContent={ 'space-around' }
        >
            <EventTypeIcon event={ event } fontSize="inherit" />
            <Box alignItems={ 'center' } display={ 'flex' } flexGrow={ 1 } justifyContent={ 'space-around' }>

                <Box marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                    <Typography
                        noWrap
                        sx={ { ml: 0.5, fontWeight: 'bold' } }
                        variant="subtitle2"
                    >
                        { event.name }
                    </Typography>
                </Box>
            </Box>

            <Box
                alignContent={ 'space-between' }
                alignItems={ 'flex-end' }
                display={ 'flex' }
                flexDirection={ 'column' }
                flexGrow={ 0 }
                flexShrink={ 1 }
                flexWrap={ 'wrap' }
                height={ '100%' }
                justifyContent={ 'space-between' }
                sx={ { direction: 'rtl' } }
            >
                <EventDurationLabel event={ event } size="smaller" sx={ { direction: 'ltr' } } />
                <EventStatusIcons event={ event } flexDirection={ 'column' } flexGrow={ 1 } size={ '0.7rem' } />
            </Box>
        </Box>
    );
}
