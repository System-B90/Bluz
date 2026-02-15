import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import RoomComponent from "@/components/schedule/event-component/room";
import { EventStatusIcons, PeriodDurationLabel, PeriodTypeIcon, useElementSize } from "@/components/schedule/event-component/utils";
import LargeEventComponent from "@/components/schedule/event-component/variants/large-event";
import MediumEventComponent from "@/components/schedule/event-component/variants/medium-event";
import MediumNarrowEventComponent from "@/components/schedule/event-component/variants/medium-narrow-event";
import ShortEventComponent from "@/components/schedule/event-component/variants/short-event";
import ShortNarrowEventComponent from "@/components/schedule/event-component/variants/short-narrow-event";
import { Period } from "@/components/schedule/types/event";
import SubjectComponent, { ModuleComponent } from "@/components/subject";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { EventProps } from "react-big-calendar";

export interface ContainerSize
{
    width: number;
    height: number;
}

const EVENT_SIZE_VARIANTS_THRESHOLDS = {
    H_TINY: 50, // Up to _px height is considered "short"
    H_MEDIUM: 150, // Up to _px height is considered "medium", above that is "tall"
    W_WIDE: 400,
    W_NARROW: 200,
};


export default function BluezEventComponent({ event: period, ...props }: EventProps<Period>)
{
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();

    const subject = getSubject(period.subject);
    const bgColor = subject?.color || theme.palette.common.black;

    const textColor = theme.palette.getContrastText(bgColor);

    const { ref, size } = useElementSize<HTMLDivElement>();
    const isShort = size.height < EVENT_SIZE_VARIANTS_THRESHOLDS.H_TINY;
    const isWide = size.width > EVENT_SIZE_VARIANTS_THRESHOLDS.W_WIDE;
    const isNarrow = size.width < EVENT_SIZE_VARIANTS_THRESHOLDS.W_NARROW;
    const isTall = size.height > EVENT_SIZE_VARIANTS_THRESHOLDS.H_MEDIUM;

    let eventComponent = null;

    if (isShort && isNarrow)
    {
        console.log('Rendering Short & Narrow Event Component');
        eventComponent = <Tooltip title={ 'Short & Narrow' }><ShortNarrowEventComponent event={ period } containerSize={ size } { ...props } /></Tooltip>;
    } else if (isShort)
    {
        console.log('Rendering Short Event Component');
        eventComponent = <Tooltip title={ 'Short' }><ShortEventComponent event={ period } { ...props } /></Tooltip>;
    } else if (isNarrow && !isTall)
    {
        console.log('Rendering Medium & Narrow Event Component');
        eventComponent = <Tooltip title={ 'Medium & Narrow' }><MediumNarrowEventComponent containerSize={ size } event={ period } { ...props } /></Tooltip>;
    }
    else if (!isTall)
    {
        console.log('Rendering Medium Event Component');
        eventComponent = <Tooltip title={ 'Medium' }><MediumEventComponent containerSize={ size } event={ period } { ...props } /></Tooltip>;
    }
    else
    {
        console.log('Rendering Large Event Component');
        eventComponent = <Tooltip title={ 'Large' }><LargeEventComponent event={ period } { ...props } /></Tooltip>;
    }

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
            { eventComponent }
        </Box>
    );
}
