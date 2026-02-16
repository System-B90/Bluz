import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { useElementSize } from "@/components/schedule/event-component/utils";
import LargeEventComponent from "@/components/schedule/event-component/variants/large-event";
import MediumEventComponent from "@/components/schedule/event-component/variants/medium-event";
import ShortEventComponent from "@/components/schedule/event-component/variants/short-event";
import ShortNarrowEventComponent from "@/components/schedule/event-component/variants/short-narrow-event";
import TinyEventComponent from "@/components/schedule/event-component/variants/tiny-event";
import TinyNarrowEventComponent from "@/components/schedule/event-component/variants/tiny-narrow-event";
import { Period } from "@/components/schedule/types/event";
import { Box, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
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
    | 'tiny-narrow'
    | 'tiny-wide'
    | 'short-narrow'
    | 'short-wide'
    | 'medium-narrow'
    | 'medium-wide'
    | 'large-narrow'
    | 'large-wide';

export default function BluezEventComponent({ event: period, ...props }: EventProps<Period>)
{
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const [ variant, setVariant ] = useState<Variant>('short-wide');

    const subject = getSubject(period.subject);
    const bgColor = subject?.color || theme.palette.common.black;

    const textColor = theme.palette.getContrastText(bgColor);

    const { ref, size } = useElementSize<HTMLDivElement>();

    useEffect(() =>
    {
        const { width, height } = size;

        const isNarrow = width < EVENT_SIZE_VARIANTS_THRESHOLDS.W_NARROW;

        let heightVariant: 'tiny' | 'short' | 'medium' | 'large';
        const widthVariant = isNarrow ? 'narrow' : 'wide';

        if (height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_TINY) { heightVariant = 'tiny'; }
        else if (height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_SHORT) { heightVariant = 'short'; }
        else if (height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_MEDIUM) { heightVariant = 'medium'; }
        else { heightVariant = 'large'; }

        setVariant(`${heightVariant}-${widthVariant}` as Variant);

    }, [ size ]);
    let eventComponent = null;

    switch (variant)
    {
        case "tiny-narrow":
            eventComponent = <Tooltip title={ 'Tiny & Narrow' }><TinyNarrowEventComponent event={ period } containerSize={ size } { ...props } /></Tooltip>;
            break;
        case "tiny-wide":
            eventComponent = <Tooltip title={ 'Tiny' }><TinyEventComponent event={ period } { ...props } /></Tooltip>;
            break;
        case "short-narrow":
            eventComponent = <Tooltip title={ 'Short & Narrow' }><ShortNarrowEventComponent containerSize={ size } event={ period } { ...props } /></Tooltip>;
            break;
        case "short-wide":
            eventComponent = <Tooltip title={ 'Short' }><ShortEventComponent containerSize={ size } event={ period } { ...props } /></Tooltip>;
            break;
        case "medium-wide":
            eventComponent = <Tooltip title={ 'Medium' }><MediumEventComponent event={ period } { ...props } /></Tooltip>;
            break;
        case "large-wide":
            eventComponent = <Tooltip title={ 'Large' }><LargeEventComponent event={ period } { ...props } /></Tooltip>;
            break;
        default:
            window.alert(`Unimplemented variant: ${variant}`);
    }

    return (
        <Box
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
            { eventComponent }
        </Box>
    );
}
