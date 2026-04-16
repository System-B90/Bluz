import { Box, Stack, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

import CourseComponent from "@/components/schedule/event-component/parts/course";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import RoomComponent from "@/components/schedule/event-component/parts/room";
import SubjectComponent, { ModuleComponent } from "@/components/schedule/event-component/parts/subject";
import { EventDurationLabel, EventStatusIcons, EventTypeIcon } from "@/components/schedule/event-component/utils";
import { Event } from "@/components/schedule/types/event";

export default function LargeEventComponent({ event: event }: EventProps<Event>)
{
    return (
        <Box padding={ 0.3 }>
            <Stack
                alignItems="flex-start"
                direction={ "column" }
                justifyContent={ "flex-start" }
                spacing={ 0.5 }
            >
                <Stack
                    alignItems="flex-start"
                    borderBottom={ 2 }
                    direction={ "row" }
                    justifyContent="space-between"
                    mb={ 0.5 }
                    paddingBottom={ 0.5 }
                    width={ '100%' }
                >
                    <Box alignItems="center" display="flex" gap={ 0 } minWidth={ 0 }>
                        <EventTypeIcon event={ event } fontSize="inherit" />

                        <Box alignItems="baseline" display="flex" flexDirection={ 'row' } gap={ 1 } minWidth={ 0 }>
                            <Typography
                                noWrap
                                sx={ { ml: 0.5, fontWeight: 'bold' } }
                                variant="subtitle2"
                            >
                                { event.name }
                            </Typography>
                        </Box>
                    </Box>

                    <Box alignItems="flex-end" display="flex" flexDirection={ 'column' } gap={ 1 }>
                        <EventDurationLabel event={ event } />

                    </Box>
                </Stack>

                <CourseComponent
                    borderBottom={ 2 }
                    courseIds={ event.courses }
                    paddingBottom={ 0.5 }
                    width={ '100%' }
                />
                <RoomComponent
                    borderBottom={ 2 }
                    paddingBottom={ 0.5 }
                    roomIds={ event.rooms }
                    width={ '100%' }
                />

                <Box alignItems={ 'baseline' } borderBottom={ 2 } display={ 'flex' } flexDirection={ 'row' } hidden={ event.type === 'break' } marginBottom={ 0 } paddingBottom={ 0.2 } width={ '100%' }>
                    <SubjectComponent fontSize={ '0.8rem' } fontWeight={ 500 } subjectId={ event.subject } />
                    <Box sx={ { width: '0.3rem' } } />
                    { event.hiveModule ? <><Typography fontSize={ '0.8rem' } fontWeight={ 300 } >/</Typography>
                        <Box sx={ { width: '0.3rem' } } />
                        <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ event.hiveModule } /></> : undefined }
                </Box>

                <Box marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } width={ '100%' } >
                    <InstructorsList borderBottom={ 2 } event={ event }
                        paddingBottom={ 0.5 }
                        width={ '100%' } />
                </Box>
            </Stack>

            { event.notes ? <Typography
                    display="block"
                    noWrap
                    sx={ { mt: 0.5, opacity: 0.8 } }
                    variant="caption"
                >
                    { event.notes }
                </Typography> : null }

            <EventStatusIcons event={ event } size={ '1.5rem' } sx={ { bottom: 0, right: 0, position: 'absolute', margin: 1 } } />
        </Box>
    );
}
