import LockPersonIcon from "@mui/icons-material/LockPerson";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import { useMemo } from "react";
import { EventProps } from "react-big-calendar";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { EventTooltipContent } from "@/components/schedule/event-component/EventTooltip";
import { UnifiedEvent } from "@/components/schedule/event-component/UnifiedEvent";
import { useElementSize } from "@/components/schedule/event-component/utils";
import { Event, EventType } from "@/components/schedule/types/event";

export type ContainerSize = {
    width: number;
    height: number;
};

export function BluzEventComponent({ event, ..._props }: EventProps<Event>) {
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const { eventFilteredOpacity } = useCalendarFilters();
    const { eventLocks } = useCalendar();

    const lock = eventLocks[event.id];

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
                    transition: theme.transitions.create([
                        "background-color",
                        "transform",
                    ]),
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
                <UnifiedEvent event={event} size={size} />

                {lock ? (
                    <Tooltip
                        arrow
                        placement="top"
                        title={`נערך כעת ע"י ${lock.lockedByName}`}
                    >
                        <Box
                            sx={{
                                position: "absolute",
                                top: 2,
                                insetInlineStart: 2,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "50%",
                                bgcolor: alpha(theme.palette.warning.main, 0.9),
                                color: theme.palette.warning.contrastText,
                                p: 0.15,
                                lineHeight: 0,
                                boxShadow: 1,
                            }}
                        >
                            <LockPersonIcon sx={{ fontSize: "0.85rem" }} />
                        </Box>
                    </Tooltip>
                ) : null}
            </Box>
        </Tooltip>
    );
}
