import { useHiveRooms } from "@/components/base/hive-rooms-provider";
import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { useHiveUsers } from "@/components/base/hive-users-provider";
import { localizer } from "@/components/schedule/calendar";
import { Period } from "@/components/schedule/types/event";
import { RoomLike } from "@/components/schedule/types/room";
import SubjectComponent from "@/components/subject";
import EmojiFoodBeverageIcon from '@mui/icons-material/EmojiFoodBeverage';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import QuizIcon from '@mui/icons-material/Quiz';
import SchoolIcon from '@mui/icons-material/School';
import { Box, Chip, ChipProps, Stack, SvgIconProps, Tooltip, Typography, TypographyProps } from "@mui/material";
import { alpha, getContrastRatio } from "@mui/material/styles";
import moment from "moment";
import { useTheme } from '@mui/material/styles';
import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EventProps } from "react-big-calendar";
import WarningIcon from '@mui/icons-material/Warning';
export function RoomComponent({ roomId, occupancy, ...props }: { roomId: RoomLike; occupancy?: number; } & ChipProps)
{
    const { getRoom } = useHiveRooms();
    const room = useMemo(() => getRoom(roomId), [ roomId, getRoom ]);

    const roomCapacity = room?.users.length ?? -1;
    const overcrowded = occupancy !== undefined && roomCapacity >= 0 && occupancy > roomCapacity;

    return (
        <Tooltip title={ overcrowded ? `עומס יתר: ${occupancy}/${roomCapacity}` : '' }>
            <Chip { ...props } label={ room?.name } sx={ { color: 'inherit' } } icon={ overcrowded ? <WarningIcon fontSize='small' color="warning" /> : undefined } />
        </Tooltip>
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
    const start = moment(period.startTime.toDate());
    const end = moment(period.endTime.toDate());

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
        <Chip label={ durationLabel } size="small" sx={ { color: 'inherit' } } { ...props } />
    );
}

function InstructorChip({ instructor: instructorId, period, size, ...props }: { instructor: number; period: Period; } & ChipProps)
{
    const { getInstructor } = useHiveUsers();
    const instructor = useMemo(() => getInstructor(instructorId), [ instructorId, getInstructor ]);

    const isLecturer = period.type === 'lecture' && instructor?.id === period.lecturer;

    return (
        <Chip
            sx={ { order: isLecturer ? 1 : 2, color: isLecturer ? '' : 'inherit' } }
            key={ instructorId }
            label={ instructor?.display_name || instructorId }
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

export default function BluezEventComponent({ event: period }: EventProps<Period>)
{
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();

    // 2. Performance: Direct lookup is usually faster than useMemo for simple objects.
    // Only keep useMemo if getSubject does heavy computation.
    const subject = getSubject(period.subject);
    const bgColor = subject?.color || theme.palette.common.black;

    // 3. Theme-aware Contrast: Use MUI's built-in contrast text generator
    // or your utility, but memoize the result if calculating manually.
    const textColor = theme.palette.getContrastText(bgColor);

    // 4. Performance: Replaced useElementSize with prop-based logic or CSS classes.
    // If you MUST know the size, pass the height from the parent (Calendar engine usually knows the height).
    // Assuming 'height' is passed via props or context in a real calendar lib, 
    // otherwise, we use CSS classes for hiding elements to avoid JS resize observers on every item.
    // *For this example, I will assume the parent passes 'height' or we use CSS.*

    // Fallback: If strict JS control is needed, keep useElementSize but be wary of performance.
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
                    alignItems="center"
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
                            roomId={ period.room }
                            size="smaller"
                        /> }
                        { omitDuration || <PeriodDurationLabel period={ period } size="smaller" /> }
                    </Box>

                </Stack> || <Stack
                    direction={ isTower ? 'column' : ((omitDuration && isWide && isSmaller) || (omitDuration && isTiny)) ? "row" : "column" }
                    alignItems="flex-start"
                    justifyContent={ isWide ? "space-between" : "flex-start" }
                    spacing={ 1 }
                >
                    <Stack
                        direction={ isTower ? 'column' : "row" }
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={ 1 }
                        mb={ isSmall ? 0 : 0.5 }
                        width={ '100%' }
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

                        <Box display="flex" alignItems="center" gap={ 1 } flexDirection={ isTower ? 'column' : 'row' }>
                            { omitRoomName || <RoomComponent
                                roomId={ period.room }
                            /> }
                            { omitDuration || <PeriodDurationLabel period={ period } /> }
                        </Box>
                    </Stack>

                    { (!omitSubjectName && !isSmall) && <SubjectComponent fontSize={ '0.8rem' } subjectId={ period.subject } /> }

                    <Stack direction={ isTower ? 'column' : "row" } gap={ (isSmall || isTiny) ? 1 : 2 } sx={ { marginTop: isSmaller ? '0 !important' : undefined } }>
                        { period.instructors.map((instructor) => (
                            <InstructorChip
                                key={ instructor }
                                instructor={ instructor }
                                period={ period }
                                size={ isTiny ? "smallest" : (isSmaller ? 'smaller' : 'small') }
                            />
                        )) }
                    </Stack>
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
