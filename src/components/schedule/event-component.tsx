import { useHiveRooms } from "@/components/base/hive-rooms-provider";
import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { useHiveUsers } from "@/components/base/hive-users-provider";
import { Period } from "@/components/schedule/types/event";
import { Room, RoomLike } from "@/components/schedule/types/room";
import SubjectComponent, { ModuleComponent } from "@/components/subject";
import ChatIcon from '@mui/icons-material/Chat';
import EmojiFoodBeverageIcon from '@mui/icons-material/EmojiFoodBeverage';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import QuizIcon from '@mui/icons-material/Quiz';
import SchoolIcon from '@mui/icons-material/School';
import WarningIcon from '@mui/icons-material/Warning';
import { Box, BoxProps, Chip, ChipProps, Link, Stack, SvgIconProps, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Dayjs } from "dayjs";
import moment from "moment";
import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EventProps } from "react-big-calendar";
import LockIcon from '@mui/icons-material/Lock';
import FmdBadIcon from '@mui/icons-material/FmdBad';
import { getHiveBaseUrl } from "@/api-client/hive";
import assert from "assert";

function SingleRoomComponent({ room, occupancy, ...props }: { room: Room; occupancy?: number; } & ChipProps)
{
    const roomCapacity = room?.users.length ?? -1;
    const overcrowded = occupancy !== undefined && roomCapacity >= 0 && occupancy > roomCapacity;

    return (
        <Tooltip title={ overcrowded ? `עומס יתר: ${occupancy}/${roomCapacity}` : '' }>
            <Link underline="hover" href={ `${getHiveBaseUrl()}/mentor/classes?id=${room?.id}` }><Chip  { ...props } label={ room?.name } sx={ { color: 'inherit' } } icon={ overcrowded ? <WarningIcon fontSize='small' color="warning" /> : undefined } /></Link>
        </Tooltip>
    );
}

export function RoomComponent({ roomIds, occupancy, ...props }: { roomIds: Array<RoomLike>; occupancy?: number; } & BoxProps)
{
    const { getRoom } = useHiveRooms();
    const rooms = useMemo(() => roomIds.map(getRoom).filter((v) => !!v), [ roomIds, getRoom ]);

    return (
        <Box display="flex" flexDirection={ 'column' } alignItems="flex-start" gap={ 0.2 } { ...props } width={ '100%' } padding={ 0 } pb={ 0.5 } borderBottom={ 2 }>
            <Typography variant="caption" fontWeight={ 600 } noWrap>{ roomIds.length === 1 ? 'חדר' : 'חדרים' }</Typography>
            < Box display={ 'flex' } gap={ 1 } flexWrap="wrap">
                { rooms.map((room) => <SingleRoomComponent key={ room.id } room={ room } occupancy={ occupancy } />) }
            </Box>
        </Box >
    );
}

export function periodTypeToHebrew(type: Period[ 'type' ]): string
{
    const LOOKUP: Record<Period[ 'type' ], string> = {
        'exercise': 'ע"ע',
        'lecture': 'הרצאה',
        'other': 'אחר',
        'break': 'הפסקה',
    };
    return LOOKUP[ type ] ?? type;
}

export function PeriodTypeIcon({ period, ...props }: { period: Period; } & SvgIconProps)
{
    let icon: ReactNode = undefined;
    switch (period.type)
    {
        case "exercise":
            icon = <FitnessCenterIcon { ...props } />;
            break;
        case "lecture":
            icon = <SchoolIcon { ...props } />;
            break;
        case "other":
            icon = <QuizIcon { ...props } />;
            break;
        case "break":
            icon = <EmojiFoodBeverageIcon { ...props } />;
            break;
        default:
            break;
    }
    return (
        <Box>
            { icon && <Tooltip title={ periodTypeToHebrew(period.type) }>
                { icon }
            </Tooltip> }
        </Box>
    );
}

function PeriodDurationLabel({ period, ...props }: { period: Period; } & ChipProps)
{
    const start = moment((period.startTime as Dayjs).toDate());
    const end = moment((period.endTime as Dayjs).toDate());

    const durationMinutes = useMemo(
        () => Math.max(0, end.diff(start, "minutes")),
        [ start.valueOf(), end.valueOf() ]
    );

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    const durationLabel =
        hours && minutes ? `${hours} ש׳ ${minutes} ד׳`
            : hours ? `${hours} ש׳`
                : `${minutes} ד׳`;

    return (
        <Tooltip title={ `${start.format('HH:mm')} - ${end.format('HH:mm')}` } >
            <Chip label={ durationLabel } size="small" sx={ { color: 'inherit' } } { ...props } />
        </Tooltip>
    );
}

function PersonChip({ instructorId, personData, period, size, ...props }: { instructorId?: number; personData?: any; period: Period; } & ChipProps)
{
    const { getInstructor } = useHiveUsers();
    const instructor = useMemo(() => instructorId ? getInstructor(instructorId) : personData, [ instructorId, getInstructor, personData ]);

    assert(!((instructorId !== undefined) && (personData !== undefined)), 'Either instructorId or personData, not both must be supplied!');

    const isLecturer = period.type === 'lecture' && period.lecturers?.includes(instructorId ?? personData);
    console.log('Is lecturer:', instructorId, isLecturer);
    /** TODO: Link component to mattermost chat with the mentor */

    return (
        <Chip
            sx={ { order: isLecturer ? 1 : 2, color: isLecturer ? '' : 'inherit' } }
            key={ instructorId ?? personData ?? 'unknown' }
            label={ instructor?.display_name ?? personData ?? instructorId }
            color={ isLecturer ? "primary" : "default" }
            size={ size || "small" }
            { ...props }
        />
    );
}

const EVENT_HEIGHT_VARIANTS = {
    TINY: 40,
    SMALLER: 60,
    SMALL: 80,
    WIDENED: 400,
    NARROW: 200,
};

function EventStatusIcons({ period, ...props }: { period: Period; } & BoxProps)
{
    return (
        <Box { ...props }>
            { period.locked && <Tooltip title="מתואם"><LockIcon /></Tooltip> }
            { period.required && <Tooltip title="קריטי"><FmdBadIcon /></Tooltip> }
            { period.personalTalk && <Tooltip title='חלון פ"א'><ChatIcon /></Tooltip> }
        </Box>
    );
}

export default function BluezEventComponent({ event: period }: EventProps<Period>)
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
            { isOneline &&
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
                            <InstructorChip
                                key={ instructor }
                                instructor={ instructor }
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

function useElementSize<T extends HTMLElement>()
{
    const ref = useRef<T | null>(null);
    const [ size, setSize ] = useState({ width: 0, height: 0 });

    useLayoutEffect(() =>
    {
        if (!ref.current) return;

        const observer = new ResizeObserver(([ entry ]) =>
        {
            const { width, height } = entry.contentRect;
            setSize({ width, height });
        });

        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return { ref, size };
}
