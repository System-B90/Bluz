import ChatIcon from '@mui/icons-material/Chat';
import EmojiFoodBeverageIcon from '@mui/icons-material/EmojiFoodBeverage';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import FmdBadIcon from '@mui/icons-material/FmdBad';
import LockIcon from '@mui/icons-material/Lock';
import QuizIcon from '@mui/icons-material/Quiz';
import SchoolIcon from '@mui/icons-material/School';
import SynagogueIcon from '@mui/icons-material/Synagogue';
import { Box, BoxProps, Chip, ChipProps, SvgIconProps, Tooltip } from "@mui/material";
import { Dayjs } from "dayjs";
import moment from "moment";
import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Event, eventTypeToHebrew } from "@/components/schedule/types/event";

export function EventTypeIcon({ event, ...props }: { event: Event; } & SvgIconProps)
{
    let icon: ReactNode = undefined;
    switch (event.type)
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
        case "prayer":
            icon = <SynagogueIcon { ...props } />;
            break;
        default:
            break;
    }
    return (
        <Box>
            { icon && <Tooltip title={ eventTypeToHebrew(event.type) }>
                { icon }
            </Tooltip> }
        </Box>
    );
}

export function EventDurationLabel({ event, sx, size, ...props }: { event: Event; } & ChipProps)
{
    const start = moment((event.startTime as Dayjs).toDate());
    const end = moment((event.endTime as Dayjs).toDate());

    const durationMinutes = useMemo(
        () => Math.max(0, end.diff(start, "minutes")),
        [ start, end ]
    );

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    const durationLabel =
        hours && minutes ? `${hours} ש׳ ${minutes} ד׳`
            : hours ? `${hours} ש׳`
                : `${minutes} ד׳`;

    return (
        <Tooltip title={ `${start.format('HH:mm')} - ${end.format('HH:mm')}` } >
            <Chip label={ durationLabel } size={ size ?? "small" } sx={ { ...sx, color: 'inherit' } } { ...props } />
        </Tooltip>
    );
}

export function EventStatusIcons({ event, size, ...props }: { event: Event; size: BoxProps[ 'fontSize' ]; } & BoxProps)
{
    const tooltipPlacement = props.flexDirection === 'column' ? 'left' : 'top';
    return (
        <Box
            position={ 'relative' }
            maxHeight={ '100%' }
            overflow={ 'hidden' }
            fontSize={ size }
            display={ props.display ?? 'flex' }
            flexDirection={ props.flexDirection ?? 'row' }
            flexWrap={ 'wrap' }
            sx={ { ...props.sx, direction: 'rtl' } }
            { ...props }
        >
            { event.locked && <Tooltip title="מתואם" placement={ tooltipPlacement }><LockIcon fontSize={ 'inherit' } /></Tooltip> }
            { event.required && <Tooltip title="קריטי" placement={ tooltipPlacement }><FmdBadIcon fontSize={ 'inherit' } /></Tooltip> }
            { event.personalTalk && <Tooltip title='חלון פ"א' placement={ tooltipPlacement }><ChatIcon fontSize={ 'inherit' } /></Tooltip> }
        </Box>
    );
}

export function useElementSize<T extends HTMLElement>()
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
