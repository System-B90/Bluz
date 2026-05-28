import { Box, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useMemo } from "react";
import { EventProps } from "react-big-calendar";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { EventTooltipContent } from "@/components/schedule/event-component/EventTooltip";
import { UnifiedEvent } from "@/components/schedule/event-component/UnifiedEvent";
import { useElementSize } from "@/components/schedule/event-component/utils";
import {
    Event,
    EventType,
} from "@/components/schedule/types/event";

export type ContainerSize = {
  width: number;
  height: number;
};

export function BluzEventComponent({ event, ...props }: EventProps<Event>) {
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const { eventFilteredOpacity } = useCalendarFilters();

    const subject = getSubject(event.subject);
    const bgColor =
    (event.type === EventType.PRAYER ? "#e0f9fe" : subject?.color) ??
    theme.palette.common.black;
    const textColor = theme.palette.getContrastText(bgColor);

    const { ref, size } = useElementSize<HTMLDivElement>();

    const filterOpacity = useMemo(
        () => eventFilteredOpacity(event),
        [event, eventFilteredOpacity],
    );

    return (
        <Tooltip
            arrow
            enterDelay={800}
            enterNextDelay={500}
            placement="top"
            title={<EventTooltipContent event={event} />}
        >
            <Box
                data-filtered-out={filterOpacity}
                ref={ref}
                sx={{
                    textAlign: "left",
                    p: 0.2,
                    bgcolor: bgColor,
                    color: textColor,
                    transition: theme.transitions.create(["background-color", "transform"]),
                    "&:hover": {
                        bgcolor: alpha(bgColor, 0.9),
                    },
                    height: "100%",
                    boxSizing: "border-box",
                    position: "relative",
                    overflow: "hidden",
                    /* Contrast-aware accent tokens for child components */
                    "--event-border": alpha(textColor, 0.25),
                    "--event-divider": alpha(textColor, 0.18),
                    "--event-subtle-bg": alpha(textColor, 0.1),
                    "--event-emphasis-bg": alpha(textColor, 0.15),
                }}
            >
                <UnifiedEvent
                    event={event}
                    size={size}
                />
            </Box>
        </Tooltip>
    );
}
