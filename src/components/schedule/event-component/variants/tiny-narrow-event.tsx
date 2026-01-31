import { ContainerSize } from "@/components/schedule/event-component/base";
import { InstructorsList } from "@/components/schedule/event-component/person";
import RoomComponent from "@/components/schedule/event-component/room";
import { PeriodDurationLabel, PeriodTypeIcon } from "@/components/schedule/event-component/utils";
import { Period } from "@/components/schedule/types/event";
import SubjectComponent, { ModuleComponent } from "@/components/subject";
import { Box, Tooltip, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";


export default function TinyNarrowEventComponent({ event: period, containerSize }: { containerSize: ContainerSize; } & EventProps<Period>)
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
            <Tooltip title={ (showStacked || isTooShort) ? <PeriodDurationLabel period={ period } /> : undefined } placement="top">
                <Box display={ 'flex' } flexDirection={ 'column' } alignItems={ 'flex-start' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                    <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                        { showStacked && <PeriodTypeIcon period={ period } /> }
                        <Typography
                            variant="subtitle2"
                            noWrap
                            sx={ { ml: 0.5, fontWeight: 'bold' } }
                        >
                            { period.name }
                        </Typography>
                    </Box>
                    { !showStacked && <PeriodDurationLabel period={ period } size="smaller" /> }
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
                    <InstructorsList period={ period } chipSize="smaller" showCaption={ false } />
                    <RoomComponent roomIds={ period.rooms } showCaption={ false } chipSize="smaller" />
                </Box>
                <Tooltip title={ period.hiveModule ? <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ period.hiveModule } /> : undefined } placement="top">
                    <SubjectComponent fontSize={ '0.8rem' } subjectId={ period.subject } />
                </Tooltip>
            </Box>
        </Box>
    );
}
