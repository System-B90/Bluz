import { Box, Stack, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

import { EventDurationLabel } from "@/components/schedule/event-component/EventDurationLabel";
import { EventStatusIcons } from "@/components/schedule/event-component/EventStatusIcons";
import { EventTypeIcon } from "@/components/schedule/event-component/EventTypeIcon";
import { CourseComponent } from "@/components/schedule/event-component/parts/course";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import { RoomComponent } from "@/components/schedule/event-component/parts/room";
import { ModuleComponent, SubjectComponent } from "@/components/schedule/event-component/parts/subject";
import { Event } from "@/components/schedule/types/event";

export function MediumEventComponent({ event: event }: EventProps<Event>)
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
                    borderBottom={ 1 }
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

                <Box alignItems={ 'stretch' } borderBottom={ 1 } display={ 'flex' } flexDirection={ 'row' } paddingBottom={ 0.5 } width={ '100%' }>
                    <Box flexBasis={ 0.5 } flexGrow={ 1 }>
                        <Box marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } width={ '100%' } >
                            <InstructorsList event={ event } showCaption={ false } width={ '100%' } />
                        </Box>

                        <Box alignItems={ 'baseline' } display={ 'flex' } flexDirection={ 'row' } hidden={ event.type === 'break' } marginBottom={ 0 } width={ '100%' }>
                            <SubjectComponent fontSize={ '0.8rem' } fontWeight={ 500 } subjectId={ event.subject } />
                            <Box sx={ { width: '0.3rem' } } />
                            { event.hiveModule ? <><Typography fontSize={ '0.8rem' } fontWeight={ 300 } >/</Typography>
                                <Box sx={ { width: '0.3rem' } } />
                                <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ event.hiveModule } /></> : undefined }
                        </Box>
                    </Box>

                    <CourseComponent
                        courseIds={ event.courses }
                        flexBasis={ 0.5 }
                        flexGrow={ 0 }
                        showCaption={ false }
                        width={ '100%' }
                    />
                    <RoomComponent
                        flexBasis={ 0.5 }
                        flexGrow={ 0 }
                        roomIds={ event.rooms }
                        showCaption={ false }
                        width={ '100%' }
                    />
                </Box>
            </Stack>

            <EventStatusIcons event={ event } size={ '1.4rem' } sx={ { bottom: 0, right: 0, position: 'absolute', margin: 0.4 } } />
        </Box>
    );
}
