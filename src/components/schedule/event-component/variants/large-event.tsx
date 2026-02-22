import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { InstructorsList } from "@/components/schedule/event-component/person";
import RoomComponent from "@/components/schedule/event-component/room";
import { EventStatusIcons, EventDurationLabel, EventTypeIcon, useElementSize } from "@/components/schedule/event-component/utils";
import TinyEventComponent from "@/components/schedule/event-component/variants/tiny-event";
import { getPresentInstructors, Event } from "@/components/schedule/types/event";
import SubjectComponent, { ModuleComponent } from "@/components/subject";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { EventProps } from "react-big-calendar";


export default function LargeEventComponent({ event: event, ...props }: EventProps<Event>)
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
                    borderBottom={ 2 }
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

                <RoomComponent
                    roomIds={ event.rooms }
                    width={ '100%' }
                    borderBottom={ 2 }
                    paddingBottom={ 0.5 }
                />


                <Box borderBottom={ 2 } paddingBottom={ 0.2 } marginBottom={ 0 } width={ '100%' } hidden={ event.type === 'break' } display={ 'flex' } flexDirection={ 'row' } alignItems={ 'baseline' }>
                    <SubjectComponent fontSize={ '0.8rem' } fontWeight={ 500 } subjectId={ event.subject } />
                    <Box sx={ { width: '0.3rem' } } />
                    { event.hiveModule ? <><Typography fontSize={ '0.8rem' } fontWeight={ 300 } >/</Typography>
                        <Box sx={ { width: '0.3rem' } } />
                        <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ event.hiveModule } /></> : undefined }
                </Box>


                <Box width={ '100%' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                    <InstructorsList event={ event } width={ '100%' }
                        borderBottom={ 2 }
                        paddingBottom={ 0.5 } />
                </Box>
            </Stack>

            { event.notes && (
                <Typography
                    variant="caption"
                    display="block"
                    noWrap
                    sx={ { mt: 0.5, opacity: 0.8 } }
                >
                    { event.notes }
                </Typography>
            ) }

            <EventStatusIcons sx={ { bottom: 0, right: 0, position: 'absolute', margin: 1 } } event={ event } size={ '1.5rem' } />
        </Box>
    );
}
