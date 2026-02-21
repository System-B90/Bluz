import { EventStatusIcons, PeriodDurationLabel, PeriodTypeIcon } from "@/components/schedule/event-component/utils";
import { PrayerEvent } from "@/components/schedule/types/event";
import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";


export default function PrayerEventComponent({ event: period }: EventProps<PrayerEvent>)
{
    return (
        <Box
            display={ 'flex' }
            justifyContent={ 'space-around' }
            alignItems={ 'center' }
            height={ '100%' }
        >
            <PeriodTypeIcon period={ period } fontSize="inherit" />
            <Box flexGrow={ 1 } display={ 'flex' } justifyContent={ 'space-around' } alignItems={ 'center' }>

                <Box marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                    <Typography
                        variant="subtitle2"
                        noWrap
                        sx={ { ml: 0.5, fontWeight: 'bold' } }
                    >
                        { period.name }
                    </Typography>
                </Box>
            </Box>

            <Box
                display={ 'flex' }
                flexWrap={ 'wrap' }
                sx={ { direction: 'rtl' } }
                flexGrow={ 0 }
                flexShrink={ 1 }
                flexDirection={ 'column' }
                alignItems={ 'flex-end' }
                justifyContent={ 'space-between' }
                alignContent={ 'space-between' }
                height={ '100%' }
            >
                <PeriodDurationLabel period={ period } size="smaller" sx={ { direction: 'ltr' } } />
                <EventStatusIcons flexGrow={ 1 } period={ period } size={ '0.7rem' } flexDirection={ 'column' } />
            </Box>
        </Box>
    );
}
