import Chip, { ChipProps } from "@mui/material/Chip";
import { SxProps, Theme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { useEventDuration } from "@/components/schedule/event-component/use-event-duration";
import { Event } from "@/components/schedule/types/event";

type EventDurationLabelProps = {
    event: Event;
    /** "chip" renders as a Chip (default), "text" renders as plain Typography */
    variant?: "chip" | "text";
    size?: ChipProps["size"];
    sx?: SxProps<Theme>;
};

export function EventDurationLabel({
    event,
    variant = "chip",
    sx,
    size,
}: EventDurationLabelProps) {
    const { hours, minutes, timeRange } = useEventDuration(event);

    const durationLabel =
        hours && minutes
            ? `${hours}:${String(minutes).padStart(2, "0")}`
            : hours
                ? `${hours} ש׳`
                : `${minutes} ד׳`;

    if (variant === "text") {
        return (
            <Tooltip title={timeRange}>
                <Typography
                    noWrap
                    sx={{ ...sx, color: "inherit", opacity: 0.85 }}
                    variant="caption"
                >
                    {durationLabel}
                </Typography>
            </Tooltip>
        );
    }

    return (
        <Tooltip title={timeRange}>
            <Chip
                label={durationLabel}
                size={size ?? "small"}
                sx={{ ...sx, color: "inherit" }}
            />
        </Tooltip>
    );
}
