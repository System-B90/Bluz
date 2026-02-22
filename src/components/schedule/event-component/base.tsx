import { useCalendarFilters } from "@/components/base/calendar-filter-provider";
import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { useElementSize } from "@/components/schedule/event-component/utils";
import LargeEventComponent from "@/components/schedule/event-component/variants/large-event";
import LargeNarrowEventComponent from "@/components/schedule/event-component/variants/large-narrow-event";
import MediumEventComponent from "@/components/schedule/event-component/variants/medium-event";
import MediumNarrowEventComponent from "@/components/schedule/event-component/variants/medium-narrow-event";
import PrayerEventComponent from "@/components/schedule/event-component/variants/prayer-event";
import ShortEventComponent from "@/components/schedule/event-component/variants/short-event";
import ShortNarrowEventComponent from "@/components/schedule/event-component/variants/short-narrow-event";
import TinyEventComponent from "@/components/schedule/event-component/variants/tiny-event";
import TinyNarrowEventComponent from "@/components/schedule/event-component/variants/tiny-narrow-event";
import { Event, PrayerEvent } from "@/components/schedule/types/event";
import { Box, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { EventProps } from "react-big-calendar";

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
    | 'prayer'
    | 'tiny-narrow'
    | 'tiny-wide'
    | 'short-narrow'
    | 'short-wide'
    | 'medium-narrow'
    | 'medium-wide'
    | 'large-narrow'
    | 'large-wide';

export default function BluezEventComponent({ event: event, ...props }: EventProps<Event>)
{
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const { isEventFilteredOut } = useCalendarFilters();
    const [ variant, setVariant ] = useState<Variant>('short-wide');

    const subject = getSubject(event.subject);
    const bgColor = subject?.color || theme.palette.common.black;

    const textColor = theme.palette.getContrastText(bgColor);

    const { ref, size } = useElementSize<HTMLDivElement>();

    useEffect(() =>
    {
        const { width, height } = size;

        const isNarrow = width < EVENT_SIZE_VARIANTS_THRESHOLDS.W_NARROW;

        let heightVariant: 'tiny' | 'short' | 'medium' | 'large';
        const widthVariant = isNarrow ? 'narrow' : 'wide';

        if (event.type === 'prayer') { setVariant('prayer'); return; }
        if (height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_TINY) { heightVariant = 'tiny'; }
        else if (height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_SHORT) { heightVariant = 'short'; }
        else if (height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_MEDIUM) { heightVariant = 'medium'; }
        else { heightVariant = 'large'; }

        setVariant(`${heightVariant}-${widthVariant}` as Variant);

    }, [ size ]);

    const isFilteredOut = useMemo(() => isEventFilteredOut(event), [ event, isEventFilteredOut ]);

    let eventComponent = null;

    switch (variant)
    {
        case "prayer":
            eventComponent = <Tooltip title={ 'תפילה' }><PrayerEventComponent event={ event as PrayerEvent } { ...props } /></Tooltip>;
            break;
        case "tiny-narrow":
            eventComponent = <Tooltip title={ 'Tiny & Narrow' }><TinyNarrowEventComponent event={ event } containerSize={ size } { ...props } /></Tooltip>;
            break;
        case "tiny-wide":
            eventComponent = <Tooltip title={ 'Tiny' }><TinyEventComponent event={ event } { ...props } /></Tooltip>;
            break;
        case "short-narrow":
            eventComponent = <Tooltip title={ 'Short & Narrow' }><ShortNarrowEventComponent containerSize={ size } event={ event } { ...props } /></Tooltip>;
            break;
        case "short-wide":
            eventComponent = <Tooltip title={ 'Short' }><ShortEventComponent containerSize={ size } event={ event } { ...props } /></Tooltip>;
            break;
        case "medium-wide":
            eventComponent = <Tooltip title={ 'Medium' }><MediumEventComponent event={ event } { ...props } /></Tooltip>;
            break;
        case "medium-narrow":
            eventComponent = <Tooltip title={ 'Medium & Narrow' }><MediumNarrowEventComponent event={ event } { ...props } /></Tooltip>;
            break;
        case "large-wide":
            eventComponent = <Tooltip title={ 'Large' }><LargeEventComponent event={ event } { ...props } /></Tooltip>;
            break;
        case "large-narrow":
            eventComponent = <Tooltip title={ 'Large & Narrow' }><LargeNarrowEventComponent event={ event } { ...props } /></Tooltip>;
            break;
        default:
            window.alert(`Unimplemented variant: ${variant}`);
    }

    return (
        <Box
            ref={ ref }
            sx={ {
                background: event.type === 'prayer' ? 'linear-gradient(225deg,rgba(92, 221, 247, 1) 0%, rgba(255, 255, 255, 1) 52%)' : null,
                textAlign: 'left',
                p: 0.2,
                bgcolor: event.type === 'prayer' ? null : bgColor,
                color: event.type === 'prayer' ? 'black' : textColor,
                transition: theme.transitions.create([ 'background-color', 'transform' ]),
                '&:hover': {
                    bgcolor: alpha(bgColor, 0.9),
                },
                height: '100%',
                boxSizing: 'border-box',
            } }
            data-filtered-out={ isFilteredOut }
        >
            { eventComponent }
        </Box>
    );
}
