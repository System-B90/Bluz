import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import RoomComponent from "@/components/schedule/event-component/room";
import { EventStatusIcons, PeriodDurationLabel, PeriodTypeIcon, useElementSize } from "@/components/schedule/event-component/utils";
import LargeEventComponent from "@/components/schedule/event-component/variants/large-event";
import MediumNarrowEventComponent from "@/components/schedule/event-component/variants/medium-narrow-event";
import TinyEventComponent from "@/components/schedule/event-component/variants/tiny-event";
import TinyNarrowEventComponent from "@/components/schedule/event-component/variants/tiny-narrow-event";
import { Period } from "@/components/schedule/types/event";
import SubjectComponent, { ModuleComponent } from "@/components/subject";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { EventProps } from "react-big-calendar";

export interface ContainerSize
{
    width: number;
    height: number;
}

const EVENT_HEIGHT_VARIANTS = {
    TINY: 70,
    SMALLER: 60,
    SMALL: 80,
    Medium: 150,
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
    const isTall = size.height > EVENT_HEIGHT_VARIANTS.Medium;

    const omitRoomName = (isSmall || isTiny || isSmaller) && !isWide;
    const isOneline = !isNarrow && isTiny;
    const isTower = isNarrow && !isSmall;
    const omitDuration = !isOneline && (isSmaller && isNarrow);
    const omitPeriodIcon = !isOneline && isSmaller && isNarrow;
    const omitNotes = isSmall || isTiny || isSmaller;
    const omitSubjectName = (isSmaller && !isWide) || isNarrow;

    let eventComponent = null;

    if (isTiny && isNarrow)
    {
        eventComponent = <TinyNarrowEventComponent event={ period } containerSize={ size } { ...props } />;
    } else if (isTiny)
    {
        eventComponent = <TinyEventComponent event={ period } { ...props } />;
    } else if (isNarrow && !isTall)
    {
        eventComponent = <MediumNarrowEventComponent containerSize={ size } event={ period } { ...props } />;
    }
    else
    {
        eventComponent = <LargeEventComponent event={ period } { ...props } />;
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
