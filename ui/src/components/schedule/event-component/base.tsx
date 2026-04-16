import { Box, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useMemo } from "react";
import { EventProps } from "react-big-calendar";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { useElementSize } from "@/components/schedule/event-component/utils";
import LargeEventComponent from "@/components/schedule/event-component/variants/LargeEvent";
import LargeNarrowEventComponent from "@/components/schedule/event-component/variants/LargeNarrowEvent";
import MediumEventComponent from "@/components/schedule/event-component/variants/MediumEvent";
import MediumNarrowEventComponent from "@/components/schedule/event-component/variants/MediumNarrowEvent";
import PrayerEventComponent from "@/components/schedule/event-component/variants/PrayerEvent";
import ShortEventComponent from "@/components/schedule/event-component/variants/ShortEvent";
import ShortNarrowEventComponent from "@/components/schedule/event-component/variants/ShortNarrowEvent";
import TinyEventComponent from "@/components/schedule/event-component/variants/TinyEvent";
import TinyNarrowEventComponent from "@/components/schedule/event-component/variants/TinyNarrowEvent";
import { Event, EventType, PrayerEvent } from "@/components/schedule/types/event";

export interface ContainerSize
{
    width: number;
    height: number;
}

const EVENT_SIZE_VARIANTS_THRESHOLDS = {
    H_TINY: 35, // Up to _px height is considered "tiny"
    H_SHORT: 110, // Up to _px height is considered "short"
    H_MEDIUM: 190, // Up to _px height is considered "medium", above that is "tall"
    W_WIDE: 400,
    W_NARROW: 200,
};

type Variant =
    | 'large-narrow'
    | 'large-wide'
    | 'medium-narrow'
    | 'medium-wide'
    | 'prayer'
    | 'short-narrow'
    | 'short-wide'
    | 'tiny-narrow'
    | 'tiny-wide';

const getEventVariant = (event: Event, width: number, height: number): Variant =>
{
    if (event.type === EventType.PRAYER)
    {
        return 'prayer';
    }

    const isNarrow = width < EVENT_SIZE_VARIANTS_THRESHOLDS.W_NARROW;
    const widthVariant = isNarrow ? 'narrow' : 'wide';

    let heightVariant: 'large' | 'medium' | 'short' | 'tiny';

    if (height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_TINY)
    {
        heightVariant = 'tiny';
    } else if (height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_SHORT)
    {
        heightVariant = 'short';
    } else if (height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_MEDIUM)
    {
        heightVariant = 'medium';
    } else
    {
        heightVariant = 'large';
    }

    return `${heightVariant}-${widthVariant}` as Variant;
};

type BluzEventInnerProps = Omit<EventProps<Event>, 'event'> & {
    variant: Variant;
    event: Event;
    size: { width: number; height: number; };
};

function BluzEventInnerComponent({ variant, event, size, ...props }: BluzEventInnerProps)
{
    switch (variant)
    {
        case 'prayer':
            return <Tooltip title="תפילה"><PrayerEventComponent event={ event as PrayerEvent } { ...props } /></Tooltip>;
        case 'tiny-narrow':
            return <Tooltip title="Tiny & Narrow"><TinyNarrowEventComponent containerSize={ size } event={ event } { ...props } /></Tooltip>;
        case 'tiny-wide':
            return <Tooltip title="Tiny"><TinyEventComponent event={ event } { ...props } /></Tooltip>;
        case 'short-narrow':
            return <Tooltip title="Short & Narrow"><ShortNarrowEventComponent containerSize={ size } event={ event } { ...props } /></Tooltip>;
        case 'short-wide':
            return <Tooltip title="Short"><ShortEventComponent containerSize={ size } event={ event } { ...props } /></Tooltip>;
        case 'medium-wide':
            return <Tooltip title="Medium"><MediumEventComponent event={ event } { ...props } /></Tooltip>;
        case 'medium-narrow':
            return <Tooltip title="Medium & Narrow"><MediumNarrowEventComponent event={ event } { ...props } /></Tooltip>;
        case 'large-wide':
            return <Tooltip title="Large"><LargeEventComponent event={ event } { ...props } /></Tooltip>;
        case 'large-narrow':
            return <Tooltip title="Large & Narrow"><LargeNarrowEventComponent event={ event } { ...props } /></Tooltip>;
        default:
            window.alert(`Unimplemented variant: ${variant}`);
            return null;
    }
}

export default function BluzEventComponent({ event, ...props }: EventProps<Event>)
{
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const { eventFilteredOpacity } = useCalendarFilters();

    const subject = getSubject(event.subject);
    const bgColor = (event.type === EventType.PRAYER ? '#e0f9fe' : subject?.color) ?? theme.palette.common.black;
    const textColor = theme.palette.getContrastText(bgColor);

    const { ref, size } = useElementSize<HTMLDivElement>();

    const filterOpacity = useMemo(() => eventFilteredOpacity(event), [ event, eventFilteredOpacity ]);

    const variant = getEventVariant(event, size.width, size.height);

    return (
        <Box
            data-filtered-out={ filterOpacity }
            ref={ ref }
            sx={ {
                textAlign: 'left',
                p: 0.2,
                bgcolor: bgColor,
                color: textColor,
                transition: theme.transitions.create([ 'background-color', 'transform' ]),
                '&:hover': {
                    bgcolor: alpha(bgColor, 0.9),
                },
                height: '100%',
                boxSizing: 'border-box',
            } }
        >
            <BluzEventInnerComponent
                event={ event }
                key={ `${size.width}-${size.height}` }
                size={ size }
                variant={ variant }
                { ...props }
            />
        </Box>
    );
}
