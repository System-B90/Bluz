import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import RoomComponent from "@/components/schedule/event-component/room";
import { EventStatusIcons, PeriodDurationLabel, PeriodTypeIcon, useElementSize } from "@/components/schedule/event-component/utils";
import TinyEventComponent from "@/components/schedule/event-component/variants/tiny-event";
import { Period } from "@/components/schedule/types/event";
import SubjectComponent, { ModuleComponent } from "@/components/subject";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { EventProps } from "react-big-calendar";


const EVENT_HEIGHT_VARIANTS = {
    TINY: 169,
    SMALLER: 170,
    SMALL: 180,
    WIDENED: 400,
    NARROW: 200,
};


export default function BluezEventComponent({ event: period, ...props }: EventProps<Period>)
{
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();

    const subject = getSubject(period.subject);
    const bgColor = subject?.color || theme.palette.common.black;

    const textColor = theme.palette.getContrastText(bgColor);

    const { ref, size } = useElementSize<HTMLDivElement>();
    const isSmall = size.height < EVENT_HEIGHT_VARIANTS.SMALL;
    const isSmaller = size.height < EVENT_HEIGHT_VARIANTS.SMALLER;
    const isTiny = size.height < EVENT_HEIGHT_VARIANTS.TINY;
    const isWide = size.width > EVENT_HEIGHT_VARIANTS.WIDENED;
    const isNarrow = size.width < EVENT_HEIGHT_VARIANTS.NARROW;

    const omitRoomName = (isSmall || isTiny || isSmaller) && !isWide;
    const isOneline = !isNarrow && isTiny;
    const isTower = isNarrow && !isSmall;
    const omitDuration = !isOneline && (isSmaller && isNarrow);
    const omitPeriodIcon = !isOneline && isSmaller && isNarrow;
    const omitNotes = isSmall || isTiny || isSmaller;
    const omitSubjectName = (isSmaller && !isWide) || isNarrow;


    return (
        <Box
            ref={ ref }
            sx={ {
                textAlign: 'left',
                p: 0.5,
                bgcolor: bgColor,
                color: textColor,
                transition: theme.transitions.create([ 'background-color', 'transform' ]),
                '&:hover': {
                    bgcolor: alpha(bgColor, 0.9),
                },
                height: '100%',
            } }
        >
            { isTiny && <TinyEventComponent event={ period } { ...props } /> ||
                isOneline &&
                <Stack direction={ "row" }
                    alignItems="flex-start"
                    justifyContent={ "space-between" }
                    spacing={ 1 }>
                    <Box display="flex" alignItems="center" minWidth={ 0 } gap={ 0 }>
                        { omitPeriodIcon || <PeriodTypeIcon period={ period } fontSize="small" /> }

                        <Box display="flex" alignItems="baseline" minWidth={ 0 } gap={ 1 }>
                            <Typography
                                variant="subtitle2"
                                noWrap
                                sx={ { ml: 0.5, fontWeight: 'bold' } }
                            >
                                { period.name }
                            </Typography>
                            { omitSubjectName || <SubjectComponent fontSize={ '0.8rem' } subjectId={ period.subject } /> }

                        </Box>
                    </Box>

                    <Stack direction="row" display={ 'flex' } flexWrap="wrap" alignItems={ 'center' } justifyContent={ 'flex-start' } spacing={ (isSmall || isTiny) ? 1 : 2 }>
                        { period.instructors.map((instructor) => (
                            <PersonChip
                                key={ instructor }
                                instructorId={ instructor }
                                period={ period }
                                size={ isOneline ? 'smaller' : (isTiny ? "smallest" : (isSmaller ? 'smaller' : 'small')) }
                            />
                        )) }
                    </Stack>
                    <Box display="flex" alignItems="center" gap={ 1 }>
                        { omitRoomName || <RoomComponent
                            roomIds={ period.rooms }
                        /> }
                        { omitDuration || <PeriodDurationLabel period={ period } size="smaller" /> }
                    </Box>

                </Stack> || <Stack
                    direction={ isTower ? 'column' : ((omitDuration && isWide && isSmaller) || (omitDuration && isTiny)) ? "row" : "column" }
                    alignItems="flex-start"
                    justifyContent={ isWide ? "space-between" : "flex-start" }
                    spacing={ 0.5 }
                >
                    <Stack
                        direction={ isTower ? 'column' : "row" }
                        alignItems="flex-start"
                        justifyContent="space-between"
                        // spacing={ 1 }
                        mb={ isSmall ? 0 : 0.5 }
                        width={ '100%' }
                        borderBottom={ 2 }
                        pb={ 0.5 }
                    >
                        <Box display="flex" alignItems="center" minWidth={ 0 } gap={ 0 }>
                            { omitPeriodIcon || <PeriodTypeIcon period={ period } fontSize="small" /> }

                            <Box display="flex" alignItems="baseline" minWidth={ 0 } gap={ 1 } flexDirection={ isTower ? 'column' : 'row' }>
                                <Typography
                                    variant="subtitle2"
                                    noWrap
                                    sx={ { ml: 0.5, fontWeight: 'bold' } }
                                >
                                    { period.name }
                                </Typography>

                                { (!omitSubjectName && isSmall) && <SubjectComponent fontSize={ '0.8rem' } subjectId={ period.subject } /> }
                            </Box>
                        </Box>

                        <Box display="flex" alignItems="flex-end" gap={ 1 } flexDirection={ 'column' }>
                            { omitDuration || <PeriodDurationLabel period={ period } /> }

                        </Box>
                    </Stack>
                    { omitRoomName || <RoomComponent
                        roomIds={ period.rooms }
                    /> }


                    { (!omitSubjectName && !isSmall) &&
                        <Box borderBottom={ 2 } paddingBottom={ 0.2 } marginBottom={ 0 } width={ isNarrow ? '' : '100%' } hidden={ period.type === 'break' } display={ 'flex' } flexDirection={ 'row' } alignItems={ 'baseline' }>
                            <SubjectComponent fontSize={ '0.8rem' } fontWeight={ 500 } subjectId={ period.subject } />
                            <Box sx={ { width: '0.3rem' } } />
                            <Typography fontSize={ '0.8rem' } fontWeight={ 300 } >/</Typography>
                            <Box sx={ { width: '0.3rem' } } />
                            <ModuleComponent fontSize={ '0.8rem' } fontWeight={ 400 } moduleId={ period.hiveModule } />
                        </Box>
                    }

                    <Box width={ '100%' } marginTop={ 0 } paddingTop={ 0 } sx={ { marginTop: '0 !important' } } >
                        <Typography variant="caption" fontWeight={ 600 } noWrap paddingBottom={ 0 } marginTop={ 0 }>{ period.instructors.length === 1 ? 'מבוזר' : 'מבוזרים' }</Typography>
                        <Stack display={ 'flex' } direction={ isTower ? 'column' : "row" } gap={ (isSmall || isTiny) ? 0.3 : 1 } flexWrap={ 'wrap' } sx={ { marginTop: isSmaller ? '0 !important' : undefined } } pb={ 0.5 } borderBottom={ 2 }>
                            {
                                period.lecturers?.includes('איש חוץ') && <PersonChip
                                    key={ 'איש חוץ' }
                                    personData={ 'איש חוץ' }
                                    period={ period }
                                    size={ isTiny ? "smallest" : (isSmaller ? 'smaller' : 'small') }
                                />
                            }
                            { period.instructors.map((instructor) => (
                                <PersonChip
                                    key={ instructor }
                                    instructorId={ instructor }
                                    period={ period }
                                    size={ isTiny ? "smallest" : (isSmaller ? 'smaller' : 'small') }
                                />
                            )) }
                        </Stack>
                    </Box>
                </Stack> }

            { (omitNotes || !period.notes) || (
                <Typography
                    variant="caption"
                    display="block"
                    noWrap
                    sx={ { mt: 0.5, opacity: 0.8 } }
                >
                    { period.notes }
                </Typography>
            ) }

            <EventStatusIcons sx={ { bottom: 0, position: 'absolute', margin: 1 } } period={ period } />
        </Box>
    );
}
