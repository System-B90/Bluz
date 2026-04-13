import { ContainerSize } from "@/components/schedule/event-component/base";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import RoomComponent from "@/components/schedule/event-component/parts/room";
import { EventDurationLabel, EventTypeIcon } from "@/components/schedule/event-component/utils";
import { Event } from "@/components/schedule/types/event";
import SubjectComponent, { ModuleComponent } from "@/components/schedule/event-component/parts/subject";
import { Box, Tooltip, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";


export default function TinyNarrowEventComponent({ event: event, containerSize }: { containerSize: ContainerSize; } & EventProps<Event>)
{
    const isTooShort = containerSize.height < 40;
    const showStacked = containerSize.height > 60;
    return (
        <Box
            display={ 'flex' }
            justifyContent={ 'space-around' }
            alignItems={ 'flex-start' }
            flexDirection={ showStacked ? 'column' : 'row' }
        >
            <Tooltip title={ (showStacked || isTooShort) ? <EventDurationLabel event={ event } /> : undefined } placement="top">
                <Box display={ 'flex' } flexDirection={ 'column' } alignItems={ 'flex-start' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                    <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                        { showStacked && <EventTypeIcon event={ event } /> }
                        <Typography
                            variant="subtitle2"
                            noWrap
                            sx={ { ml: 0.5, fontWeight: 'bold' } }
                        >
                            { event.name }
                        </Typography>
                    </Box>
                    { !showStacked && <EventDurationLabel event={ event } size="smaller" /> }
                </Box>
            </Tooltip>

            <Box>
                <Box
                    marginTop={ 0 }
                    paddingTop={ 0 }
                    sx={ { marginTop: '0 !important' } }
                    flexGrow={ 1 }
                    display={ 'flex' }
                    flexWrap={ 'wrap' }
                    justifyContent={ showStacked ? 'flex-start' : 'center' }
                    gap={ 0.2 }
                    paddingBottom={ 0.2 }
                    borderBottom={ 2 }
                >
                    <InstructorsList event={ event } chipSize="smaller" showCaption={ false } />
                    <RoomComponent roomIds={ event.rooms } showCaption={ false } chipSize="smaller" />
                </Box>
                <Tooltip title={ event.hiveModule ? <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ event.hiveModule } /> : undefined } placement="top">
                    <SubjectComponent fontSize={ '0.8rem' } subjectId={ event.subject } />
                </Tooltip>
            </Box>
        </Box>
    );
}
