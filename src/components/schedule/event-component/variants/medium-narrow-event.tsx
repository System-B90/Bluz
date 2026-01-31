import { ContainerSize } from "@/components/schedule/event-component/base";
import { InstructorsList } from "@/components/schedule/event-component/person";
import RoomComponent from "@/components/schedule/event-component/room";
import { PeriodDurationLabel, PeriodTypeIcon } from "@/components/schedule/event-component/utils";
import { Period } from "@/components/schedule/types/event";
import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";


export default function MediumNarrowEventComponent({ event: period, containerSize }: { containerSize: ContainerSize; } & EventProps<Period>)
{
    return (
        <Box
            display={ 'flex' }
            justifyContent={ 'space-around' }
            flexDirection={ 'column' }
        >
            <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' } justifyContent={ 'space-between' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                {/* <PeriodTypeIcon period={ period } /> */ }
                <Typography
                    variant="subtitle2"
                    noWrap
                    sx={ { ml: 0.5, fontWeight: 'bold' } }
                >
                    { period.name }
                </Typography>
                <PeriodDurationLabel period={ period } size="smaller" />
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
                <InstructorsList period={ period } chipSize="smaller" showCaption={ false } paddingBottom={ 0.5 } borderBottom={ 2 } />
                <RoomComponent roomIds={ period.rooms } showCaption={ false } chipSize="smaller" paddingBottom={ 0.5 } borderBottom={ 2 } />
            </Box>
        </Box>
    );
}
