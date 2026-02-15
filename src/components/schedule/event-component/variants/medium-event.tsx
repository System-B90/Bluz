import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { ContainerSize } from "@/components/schedule/event-component/base";
import { InstructorsList } from "@/components/schedule/event-component/person";
import RoomComponent from "@/components/schedule/event-component/room";
import { EventStatusIcons, PeriodDurationLabel, PeriodTypeIcon } from "@/components/schedule/event-component/utils";
import { Period } from "@/components/schedule/types/event";
import SubjectComponent, { ModuleComponent } from "@/components/subject";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { EventProps } from "react-big-calendar";


export default function MediumEventComponent({ event: period, containerSize, ...props }: { containerSize: ContainerSize; } & EventProps<Period>)
{
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();

    const subject = getSubject(period.subject);

    return (
        <Box
            display={ 'flex' }
            justifyContent={ 'space-around' }
            alignItems={ 'flex-start' }
            height={ '100%' }
        >
            <Box flexGrow={ 1 } display={ 'flex' } flexDirection={ 'column' } justifyContent={ 'space-around' } alignItems={ 'flex-start' } gap={ 0.3 }>
                <Box marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' } gap={ 0 }>
                    <Box display={ 'flex' } flexGrow={ 1 } alignItems={ 'baseline' }>
                        <PeriodTypeIcon period={ period } fontSize="inherit" />
                        <Typography
                            variant="subtitle2"
                            noWrap
                            sx={ { ml: 0.5, fontWeight: 'bold' } }
                        >
                            { period.name }
                        </Typography>
                    </Box>
                    <Box sx={ { width: '0.3rem' } } />
                    <Box textOverflow={ 'ellipsis' } hidden={ period.type === 'break' } display={ 'flex' } flexDirection={ 'row' } alignItems={ 'baseline' }>
                        <SubjectComponent fontSize={ '0.8rem' } fontWeight={ 500 } subjectId={ period.subject } />
                        <Box sx={ { width: '0.2rem' } } />
                        { period.hiveModule ? <><Typography fontSize={ '0.8rem' } fontWeight={ 400 } >/</Typography>
                            <Box sx={ { width: '0.2rem' } } />
                            <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ period.hiveModule } /></> : undefined }
                    </Box>
                </Box>
                <Box display={ 'flex' } flexWrap={ 'wrap' } justifyContent={ 'flex-start' } gap={ 0.2 }>
                    <InstructorsList period={ period } chipSize="smaller" showCaption={ false } />
                    <RoomComponent roomIds={ period.rooms } showCaption={ false } chipSize="smaller" />
                </Box>
            </Box>

            <Box display={ 'flex' } flexGrow={ 0 } flexShrink={ 1 } flexDirection={ 'column' } alignItems={ 'flex-end' } justifyContent={ 'space-between' } alignContent={ 'space-between' } height={ '100%' }>
                <PeriodDurationLabel period={ period } size="smaller" />
                <EventStatusIcons period={ period } size={ '1.2rem' } flexDirection={ 'column' } />
            </Box>
        </Box>
    );
}
