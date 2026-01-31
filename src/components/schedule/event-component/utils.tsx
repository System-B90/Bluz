import { Period, periodTypeToHebrew } from "@/components/schedule/types/event";
import ChatIcon from '@mui/icons-material/Chat';
import EmojiFoodBeverageIcon from '@mui/icons-material/EmojiFoodBeverage';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import FmdBadIcon from '@mui/icons-material/FmdBad';
import LockIcon from '@mui/icons-material/Lock';
import QuizIcon from '@mui/icons-material/Quiz';
import SchoolIcon from '@mui/icons-material/School';
import { Box, BoxProps, Chip, ChipProps, SvgIconProps, Tooltip } from "@mui/material";
import { Dayjs } from "dayjs";
import moment from "moment";
import { ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";

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

export function PeriodDurationLabel({ period, ...props }: { period: Period; } & ChipProps)
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

export function EventStatusIcons({ period, ...props }: { period: Period; } & BoxProps)
{
    return (
        <Box { ...props }>
            { period.locked && <Tooltip title="מתואם"><LockIcon /></Tooltip> }
            { period.required && <Tooltip title="קריטי"><FmdBadIcon /></Tooltip> }
            { period.personalTalk && <Tooltip title='חלון פ"א'><ChatIcon /></Tooltip> }
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
