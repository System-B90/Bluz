import { InstructorsList } from "@/components/schedule/event-component/person";
import RoomComponent from "@/components/schedule/event-component/room";
import { PeriodDurationLabel } from "@/components/schedule/event-component/utils";
import { Period } from "@/components/schedule/types/event";
import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";


export default function TinyEventComponent({ event: period }: EventProps<Period>)
{
    return (
        <Box
            display={ 'flex' }
            justifyContent={ 'space-around' }
        >
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
                gap={ 1 }
            >
                <InstructorsList period={ period } chipSize="smaller" showCaption={ false } />
                <RoomComponent roomIds={ period.rooms } showCaption={ false } chipSize="smaller" />
            </Box>

            <PeriodDurationLabel period={ period } />
        </Box>
    );
}
