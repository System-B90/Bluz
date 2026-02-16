import { InstructorsList } from "@/components/schedule/event-component/person";
import RoomComponent from "@/components/schedule/event-component/room";
import { EventStatusIcons, PeriodDurationLabel } from "@/components/schedule/event-component/utils";
import { Period } from "@/components/schedule/types/event";
import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";


export default function TinyEventComponent({ event: period }: EventProps<Period>)
{
    return (
        <Box
            display={ 'flex' }
            justifyContent={ 'space-around' }
            alignItems={ 'center' }
            height={ '100%' }
        >
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

                <Box
                    marginTop={ 0 }
                    paddingTop={ 0 }
                    sx={ { marginTop: '0 !important' } }
                    flexGrow={ 1 }
                    display={ 'flex' }
                    flexWrap={ 'wrap' }
                    justifyContent={ 'center' }
                    gap={ 0.1 }
                    alignItems={ 'stretch' }
                >
                    <InstructorsList period={ period } chipSize="smallest" showCaption={ false } display={ 'flex' } flexDirection={ 'column' } />
                    <Box sx={ { width: '0.3rem' } } display={ 'flex' } alignItems={ 'center' } justifyContent={ 'center' } alignContent={ 'center' }>
                        <Box sx={ { height: '90%', width: '1px', backgroundColor: 'divider' } } />
                    </Box>
                    <RoomComponent roomIds={ period.rooms } showCaption={ false } chipSize="smallest" display={ 'flex' } flexDirection={ 'column' } />
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
                <PeriodDurationLabel period={ period } size="smallest" sx={ { direction: 'ltr' } } />
                <EventStatusIcons flexGrow={ 1 } period={ period } size={ '0.7rem' } flexDirection={ 'column' } />
            </Box>
        </Box>
    );
}
