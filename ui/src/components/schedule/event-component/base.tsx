import LockPersonIcon from "@mui/icons-material/LockPerson";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import { useMemo } from "react";
import { EventProps } from "react-big-calendar";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useCustomColors } from "@/components/base/CustomColorsProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { resolveEventColor } from "@/components/schedule/event-component/event-colors";
import { EventTooltipContent } from "@/components/schedule/event-component/EventTooltip";
import { UnifiedEvent } from "@/components/schedule/event-component/UnifiedEvent";
import { useElementSize } from "@/components/schedule/event-component/utils";
import { Event } from "@/components/schedule/types/event";

export type ContainerSize = {
    width: number;
    height: number;
};

export function BluzEventComponent({ event, ..._props }: EventProps<Event>) {
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const { getCustomColor } = useCustomColors();
    const { eventFilteredOpacity } = useCalendarFilters();
    const { eventLocks } = useCalendar();

    const lock = eventLocks[event.id];

    const subject = getSubject(event.subject);
    const bgColor = resolveEventColor(
        event,
        subject,
        { getCustomColor, getSubject },
        theme.palette.common.black,
    );
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
                    /* Fake (פיקטיבי) events read as placeholders for
                       Checkers/Segel: dashed outline + reduced opacity (#102). */
                    ...(event.fake && {
                        border: `2px dashed ${alpha(textColor, 0.65)}`,
                        opacity: 0.75,
                    }),
                    /* Contrast-aware accent tokens for child components */
                    "--event-border": alpha(textColor, 0.25),
                    "--event-divider": alpha(textColor, 0.18),
                    "--event-subtle-bg": alpha(textColor, 0.1),
                    "--event-emphasis-bg": alpha(textColor, 0.15),
                }}
            >
                <UnifiedEvent event={event} size={size} />

                {event.fake ? (
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: 2,
                            insetInlineEnd: 4,
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                            color: alpha(textColor, 0.75),
                            pointerEvents: "none",
                        }}
                    >
                        פיקטיבי
                    </Box>
                ) : null}

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
                                bgcolor: alpha(theme.palette.warning.main, 0.92),
                                color: theme.palette.warning.contrastText,
                                p: 0.15,
                                lineHeight: 0,
                                cursor: "default",
                                transformOrigin: "center",
                                /* Pop in on appearance, then breathe a soft ring
                                   to signal that someone is actively editing. */
                                animation:
                                    "lock-badge-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), lock-badge-pulse 2.6s ease-in-out 0.22s infinite",
                                "@keyframes lock-badge-in": {
                                    from: {
                                        transform: "scale(0)",
                                        opacity: 0,
                                    },
                                    to: {
                                        transform: "scale(1)",
                                        opacity: 1,
                                    },
                                },
                                "@keyframes lock-badge-pulse": {
                                    "0%, 100%": {
                                        boxShadow: `0 0 0 0 ${alpha(theme.palette.warning.main, 0.5)}`,
                                    },
                                    "50%": {
                                        boxShadow: `0 0 0 4px ${alpha(theme.palette.warning.main, 0)}`,
                                    },
                                },
                                "@media (prefers-reduced-motion: reduce)": {
                                    animation: "none",
                                },
                                transition: "transform 0.15s ease-in-out",
                                "&:hover": {
                                    transform: "scale(1.15)",
                                },
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
