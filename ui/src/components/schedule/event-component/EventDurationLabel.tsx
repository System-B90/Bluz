import Chip from "@mui/material/Chip";
import ChipProps from "@mui/material/ChipProps";
import SxProps from "@mui/material/SxProps";
import Theme from "@mui/material/Theme";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Dayjs } from "dayjs";
import moment from "moment";
import { useMemo } from "react";

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
    const start = moment((event.startTime as Dayjs).toDate());
    const end = moment((event.endTime as Dayjs).toDate());

    const durationMinutes = useMemo(
        () => Math.max(0, end.diff(start, "minutes")),
        [start, end],
    );

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    const durationLabel =
        hours && minutes
            ? `${hours}:${String(minutes).padStart(2, "0")}`
            : hours
              ? `${hours} ש׳`
              : `${minutes} ד׳`;

    const timeRange = `${start.format("HH:mm")} - ${end.format("HH:mm")}`;

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
