import { Box, Tooltip, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

import { ContainerSize } from "@/components/schedule/event-component/base";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import RoomComponent from "@/components/schedule/event-component/parts/room";
import SubjectComponent, { ModuleComponent } from "@/components/schedule/event-component/parts/subject";
import { EventDurationLabel, EventTypeIcon } from "@/components/schedule/event-component/utils";
import { Event } from "@/components/schedule/types/event";

export default function TinyNarrowEventComponent({ event: event, containerSize }: { containerSize: ContainerSize; } & EventProps<Event>)
{
    const isTooShort = containerSize.height < 40;
    const showStacked = containerSize.height > 60;
    return (
        <Box
            alignItems={ 'flex-start' }
            display={ 'flex' }
            flexDirection={ showStacked ? 'column' : 'row' }
            justifyContent={ 'space-around' }
        >
            <Tooltip placement="top" title={ (showStacked || isTooShort) ? <EventDurationLabel event={ event } /> : undefined }>
                <Box alignItems={ 'flex-start' } display={ 'flex' } flexDirection={ 'column' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                    <Box alignItems={ 'center' } display={ 'flex' } flexDirection={ 'row' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                        { showStacked ? <EventTypeIcon event={ event } /> : null }
                        <Typography
                            noWrap
                            sx={ { ml: 0.5, fontWeight: 'bold' } }
                            variant="subtitle2"
                        >
                            { event.name }
                        </Typography>
                    </Box>
                    { !showStacked && <EventDurationLabel event={ event } size="smaller" /> }
                </Box>
            </Tooltip>

            <Box>
                <Box
                    borderBottom={ 2 }
                    display={ 'flex' }
                    flexGrow={ 1 }
                    flexWrap={ 'wrap' }
                    gap={ 0.2 }
                    justifyContent={ showStacked ? 'flex-start' : 'center' }
                    marginTop={ 0 }
                    paddingBottom={ 0.2 }
                    paddingTop={ 0 }
                    sx={ { marginTop: '0 !important' } }
                >
                    <InstructorsList chipSize="smaller" event={ event } showCaption={ false } />
                    <RoomComponent chipSize="smaller" roomIds={ event.rooms } showCaption={ false } />
                </Box>
                <Tooltip placement="top" title={ event.hiveModule ? <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ event.hiveModule } /> : undefined }>
                    <SubjectComponent fontSize={ '0.8rem' } subjectId={ event.subject } />
                </Tooltip>
            </Box>
        </Box>
    );
}
