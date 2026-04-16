import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

import { ContainerSize } from "@/components/schedule/event-component/base";
import CourseComponent from "@/components/schedule/event-component/parts/course";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import RoomComponent from "@/components/schedule/event-component/parts/room";
import SubjectComponent, { ModuleComponent } from "@/components/schedule/event-component/parts/subject";
import { EventDurationLabel, EventStatusIcons, EventTypeIcon } from "@/components/schedule/event-component/utils";
import { Event } from "@/components/schedule/types/event";

export default function ShortEventComponent({ event: event, containerSize: _containerSize }: { containerSize: ContainerSize; } & EventProps<Event>)
{
    return (
        <Box
            padding={ 0.3 }
            display={ 'flex' }
            justifyContent={ 'space-around' }
            alignItems={ 'flex-start' }
            height={ '100%' }
        >
            <Box
                flexGrow={ 1 }
                display={ 'flex' }
                flexDirection={ 'column' }
                justifyContent={ 'space-around' }
                alignItems={ 'flex-start' }
                gap={ 0.3 }
                height={ '100%' }
            >
                <Box marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' } gap={ 0 }>
                    <Box display={ 'flex' } flexGrow={ 1 } alignItems={ 'baseline' }>
                        <EventTypeIcon event={ event } fontSize="inherit" />
                        <Typography
                            variant="subtitle2"
                            noWrap
                            sx={ { ml: 0.5, fontWeight: 'bold' } }
                        >
                            { event.name }
                        </Typography>
                    </Box>
                    <Box sx={ { width: '0.3rem' } } />
                    <Box textOverflow={ 'ellipsis' } hidden={ event.type === 'break' } display={ 'flex' } flexDirection={ 'row' } alignItems={ 'baseline' }>
                        <SubjectComponent fontSize={ '0.8rem' } fontWeight={ 500 } subjectId={ event.subject } />
                        <Box sx={ { width: '0.2rem' } } />
                        { event.hiveModule ? <><Typography fontSize={ '0.8rem' } fontWeight={ 400 } >/</Typography>
                            <Box sx={ { width: '0.2rem' } } />
                            <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ event.hiveModule } /></> : undefined }
                    </Box>
                </Box>
                <Box
                    display={ 'flex' }
                    flexDirection={ 'column' }
                    flexWrap={ 'wrap' }
                    justifyContent={ 'flex-start' }
                    gap={ 0.2 }
                    overflow={ 'hidden' }
                    height={ '100%' }
                >
                    <InstructorsList event={ event } chipSize="smaller" showCaption={ false } />
                    <CourseComponent
                        courseIds={ event.courses }
                        showCaption={ false } chipSize="smaller"
                    />
                    <RoomComponent roomIds={ event.rooms } showCaption={ false } chipSize="smaller" />
                </Box>
            </Box>

            <Box position={ 'relative' }
                display={ 'flex' }
                flexGrow={ 0 }
                flexShrink={ 1 }
                flexDirection={ 'column' }
                alignItems={ 'flex-end' }
                justifyContent={ 'space-between' }
                alignContent={ 'space-between' }
                height={ '100%' }
                gap={ 0.2 }
            >
                <EventDurationLabel event={ event } size="smaller" />
                <EventStatusIcons flexGrow={ 1 } event={ event } size={ '1rem' } flexDirection={ 'column' } justifyContent={ 'flex-end' } />
            </Box>
        </Box>
    );
}
