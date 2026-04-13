import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import RoomComponent from "@/components/schedule/event-component/parts/room";
import { EventStatusIcons, EventDurationLabel, EventTypeIcon, useElementSize } from "@/components/schedule/event-component/utils";
import TinyEventComponent from "@/components/schedule/event-component/variants/TinyEvent";
import { getPresentInstructors, Event } from "@/components/schedule/types/event";
import SubjectComponent, { ModuleComponent } from "@/components/schedule/event-component/parts/subject";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { EventProps } from "react-big-calendar";
import CourseComponent from "@/components/schedule/event-component/parts/course";


export default function MediumEventComponent({ event: event, ...props }: EventProps<Event>)
{
    return (
        <Box padding={ 0.3 }>
            <Stack
                direction={ "column" }
                alignItems="flex-start"
                justifyContent={ "flex-start" }
                spacing={ 0.5 }
            >
                <Stack
                    direction={ "row" }
                    alignItems="flex-start"
                    justifyContent="space-between"
                    mb={ 0.5 }
                    width={ '100%' }
                    borderBottom={ 1 }
                    paddingBottom={ 0.5 }
                >
                    <Box display="flex" alignItems="center" minWidth={ 0 } gap={ 0 }>
                        <EventTypeIcon event={ event } fontSize="inherit" />
                        <Box display="flex" alignItems="baseline" minWidth={ 0 } gap={ 1 } flexDirection={ 'row' }>
                            <Typography
                                variant="subtitle2"
                                noWrap
                                sx={ { ml: 0.5, fontWeight: 'bold' } }
                            >
                                { event.name }
                            </Typography>
                        </Box>
                    </Box>

                    <Box display="flex" alignItems="flex-end" gap={ 1 } flexDirection={ 'column' }>
                        <EventDurationLabel event={ event } />

                    </Box>
                </Stack>

                <Box display={ 'flex' } flexDirection={ 'row' } width={ '100%' } alignItems={ 'stretch' } borderBottom={ 1 } paddingBottom={ 0.5 }>
                    <Box flexGrow={ 1 } flexBasis={ 0.5 }>
                        <Box width={ '100%' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                            <InstructorsList event={ event } width={ '100%' } showCaption={ false } />
                        </Box>

                        <Box marginBottom={ 0 } width={ '100%' } hidden={ event.type === 'break' } display={ 'flex' } flexDirection={ 'row' } alignItems={ 'baseline' }>
                            <SubjectComponent fontSize={ '0.8rem' } fontWeight={ 500 } subjectId={ event.subject } />
                            <Box sx={ { width: '0.3rem' } } />
                            { event.hiveModule ? <><Typography fontSize={ '0.8rem' } fontWeight={ 300 } >/</Typography>
                                <Box sx={ { width: '0.3rem' } } />
                                <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ event.hiveModule } /></> : undefined }
                        </Box>
                    </Box>

                    <CourseComponent
                        flexGrow={ 0 }
                        flexBasis={ 0.5 }
                        courseIds={ event.courses }
                        width={ '100%' }
                        showCaption={ false }
                    />
                    <RoomComponent
                        flexGrow={ 0 }
                        flexBasis={ 0.5 }
                        roomIds={ event.rooms }
                        width={ '100%' }
                        showCaption={ false }
                    />
                </Box>
            </Stack>

            <EventStatusIcons sx={ { bottom: 0, right: 0, position: 'absolute', margin: 0.4 } } event={ event } size={ '1.4rem' } />
        </Box>
    );
}
